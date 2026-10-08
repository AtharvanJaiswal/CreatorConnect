import { Queue } from 'bullmq';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  RequestUploadUrlInput,
  RequestUploadUrlResponse,
  ConfirmUploadInput,
  MediaAssetResponse,
} from '@creatorconnect/contracts';
import { mediaRepository, MediaRepository } from './media.repository.js';
import { S3StorageService, MockStorageService, type IStorageService } from './storage.service.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  UploadSizeMismatchError,
  InvalidMediaStateError,
} from '../../errors/app-error.js';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
};

const MAX_BYTES_BY_TYPE: Record<string, number> = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 500 * 1024 * 1024, // 500MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 25 * 1024 * 1024, // 25MB
};

export class MediaService {
  private mediaQueue?: Queue;

  constructor(
    private repo: MediaRepository = mediaRepository,
    private storage: IStorageService = process.env.NODE_ENV === 'test'
      ? new MockStorageService()
      : new S3StorageService(),
  ) {
    if (process.env.NODE_ENV !== 'test') {
      const redisUrl = process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0';
      try {
        const parsed = new URL(redisUrl);
        this.mediaQueue = new Queue('media-processing', {
          connection: {
            host: parsed.hostname,
            port: Number(parsed.port) || 6379,
            password: parsed.password || undefined,
          },
        });
      } catch {
        // Fallback without queue if redis url is not set
      }
    }
  }

  async requestUploadUrl(
    userId: string,
    input: RequestUploadUrlInput,
  ): Promise<RequestUploadUrlResponse> {
    const ext = MIME_EXTENSION_MAP[input.mimeType];
    if (!ext) {
      throw new BadRequestError(`Unsupported MIME type: ${input.mimeType}`);
    }

    const maxBytes = MAX_BYTES_BY_TYPE[input.mediaType];
    if (!maxBytes || input.byteSize > maxBytes) {
      throw new BadRequestError(
        `File size exceeds maximum allowed limit for ${input.mediaType} (${maxBytes} bytes).`,
      );
    }

    const assetId = generateUuidV7();
    const storageKey = `quarantine/${userId}/${assetId}.${ext}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.repo.create({
      id: assetId,
      userId,
      storageKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      mediaType: input.mediaType,
      status: 'QUARANTINED',
      expiresAt,
    });

    const uploadUrl = await this.storage.generateUploadUrl(
      storageKey,
      input.mimeType,
      input.byteSize,
      900,
    );

    return {
      assetId,
      uploadUrl,
      storageKey,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirmUpload(userId: string, input: ConfirmUploadInput): Promise<MediaAssetResponse> {
    const asset = await this.repo.findById(input.assetId);
    if (!asset) {
      throw new NotFoundError('Media asset not found.');
    }

    if (asset.userId !== userId) {
      throw new ForbiddenError('You do not have access to this media asset.');
    }

    // Atomic CAS: QUARANTINED -> PENDING_SCAN
    const updatedCount = await this.repo.updateStatusCAS(asset.id, 'QUARANTINED', 'PENDING_SCAN');
    if (updatedCount === 0) {
      if (asset.status === 'PENDING_SCAN' || asset.status === 'ACTIVE') {
        return this.mapToResponse(asset);
      }
      throw new InvalidMediaStateError(
        `Media asset cannot be confirmed in its current state: ${asset.status}`,
      );
    }

    // HeadObject Byte Size Validation Invariant
    const head = await this.storage.getHeadObject(asset.storageKey);
    if (!head || head.contentLength !== asset.byteSize) {
      // Byte size mismatch: mark invalid and remove
      await this.repo.update(asset.id, { status: 'REJECTED_INVALID' });
      await this.storage.deleteObject(asset.storageKey).catch(() => {});
      throw new UploadSizeMismatchError(
        `Uploaded object size (${head?.contentLength ?? 0} bytes) does not match declared size (${asset.byteSize} bytes).`,
      );
    }

    // Enqueue BullMQ worker job with deterministic jobId = assetId
    if (this.mediaQueue) {
      await this.mediaQueue.add(
        'media-scan-and-process',
        {
          assetId: asset.id,
          userId: asset.userId,
          storageKey: asset.storageKey,
          mimeType: asset.mimeType,
          mediaType: asset.mediaType,
          byteSize: asset.byteSize,
        },
        {
          jobId: asset.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        },
      );
    }

    const updatedAsset = (await this.repo.findById(asset.id))!;
    return this.mapToResponse(updatedAsset);
  }

  async getAsset(
    callerUserId: string,
    assetId: string,
    isAdmin = false,
  ): Promise<MediaAssetResponse> {
    const asset = await this.repo.findByIdWithParents(assetId);
    if (!asset) {
      throw new NotFoundError('Media asset not found.');
    }

    const isOwnerOrAdmin = asset.userId === callerUserId || isAdmin;

    // 1. Non-active media assets: ONLY owner/admin can view metadata; NO URL issued.
    if (asset.status !== 'ACTIVE') {
      if (!isOwnerOrAdmin) {
        throw new ForbiddenError('Access to non-active media asset denied.');
      }
      return this.mapToResponse(asset, false);
    }

    // 2. Owner account lifecycle governance:
    // If owner account is SUSPENDED or DEACTIVATED, or creatorProfile is deleted, NO access/URL is issued.
    if (asset.user) {
      if (asset.user.status === 'SUSPENDED') {
        throw new ForbiddenError('Owner account is suspended. Access denied.');
      }
      if (asset.user.status === 'DEACTIVATED') {
        throw new ForbiddenError('Owner account is deactivated. Access denied.');
      }
      if (asset.user.creatorProfile?.deletedAt) {
        throw new ForbiddenError('Owner profile has been deleted. Access denied.');
      }
    }

    // 3. Parent visibility inheritance & Unattached asset policy:
    // Unattached active media:
    if (!asset.portfolioMedia || asset.portfolioMedia.length === 0) {
      if (!isOwnerOrAdmin) {
        throw new ForbiddenError(
          'Access denied to unattached media asset. Only the owner can access unattached media.',
        );
      }
      // Owner accessing unattached media: issued short-lived authorized URL (private)
      return this.mapToResponse(asset, true, true);
    }

    // Attached to one or more PortfolioItems:
    const activeParents = asset.portfolioMedia
      .map((pm: any) => pm.portfolioItem)
      .filter((pi: any) => !pi.deletedAt);

    if (activeParents.length === 0) {
      // All parent items are soft-deleted
      if (!isOwnerOrAdmin) {
        throw new ForbiddenError('Access denied. Parent portfolio item has been deleted.');
      }
      return this.mapToResponse(asset, true, true);
    }

    if (isOwnerOrAdmin) {
      const hasPublicParent = activeParents.some(
        (pi: any) => pi.visibility === 'PUBLIC' || pi.visibility === 'UNLISTED',
      );
      return this.mapToResponse(asset, true, !hasPublicParent);
    }

    // Unrelated caller:
    const hasPublicParent = activeParents.some((pi: any) => pi.visibility === 'PUBLIC');
    const hasUnlistedParent = activeParents.some((pi: any) => pi.visibility === 'UNLISTED');
    const allPrivate = activeParents.every((pi: any) => pi.visibility === 'PRIVATE');

    if (allPrivate) {
      throw new ForbiddenError(
        'Access to private media denied. Only the owner can view this asset.',
      );
    }

    if (hasPublicParent || hasUnlistedParent) {
      // Public / Unlisted parent grants access
      return this.mapToResponse(asset, true, false);
    }

    throw new ForbiddenError('Access to media asset denied.');
  }

  async mapToResponse(
    asset: any,
    generateUrls = true,
    isPrivate = false,
  ): Promise<MediaAssetResponse> {
    const isActive = asset.status === 'ACTIVE';

    const url =
      isActive && generateUrls
        ? await this.storage.getDownloadUrl(asset.storageKey, 900, isPrivate)
        : null;
    const thumbnailUrl =
      isActive && generateUrls && asset.thumbnailKey
        ? await this.storage.getDownloadUrl(asset.thumbnailKey, 900, isPrivate)
        : null;
    const previewUrl =
      isActive && generateUrls && asset.previewKey
        ? await this.storage.getDownloadUrl(asset.previewKey, 900, isPrivate)
        : null;

    return {
      id: asset.id,
      userId: asset.userId,
      storageKey: asset.storageKey,
      thumbnailKey: asset.thumbnailKey,
      previewKey: asset.previewKey,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      mediaType: asset.mediaType,
      status: asset.status,
      width: asset.width,
      height: asset.height,
      durationSec: asset.durationSec,
      url,
      thumbnailUrl,
      previewUrl,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    };
  }
}

export const mediaService = new MediaService();
