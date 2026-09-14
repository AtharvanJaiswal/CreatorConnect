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
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
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

  async getAsset(userId: string, assetId: string): Promise<MediaAssetResponse> {
    const asset = await this.repo.findById(assetId);
    if (!asset) {
      throw new NotFoundError('Media asset not found.');
    }

    // Only owner can view quarantined assets; active assets can be viewed
    if (asset.status !== 'ACTIVE' && asset.userId !== userId) {
      throw new ForbiddenError('Access to non-active media asset denied.');
    }

    return this.mapToResponse(asset);
  }

  async mapToResponse(asset: any): Promise<MediaAssetResponse> {
    const url = await this.storage.getDownloadUrl(asset.storageKey);
    const thumbnailUrl = asset.thumbnailKey
      ? await this.storage.getDownloadUrl(asset.thumbnailKey)
      : null;
    const previewUrl = asset.previewKey
      ? await this.storage.getDownloadUrl(asset.previewKey)
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
