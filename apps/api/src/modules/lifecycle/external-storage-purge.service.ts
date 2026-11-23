import pino, { type Logger } from 'pino';
import {
  S3Client,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface PurgeResult {
  userId: string;
  purgedCount: number;
  purgedKeys: string[];
  multipartUploadsAborted: number;
}

export interface IExternalStoragePurgeService {
  purgeUserAssets(userId: string): Promise<PurgeResult>;
}

export class S3StoragePurgeAdapter implements IExternalStoragePurgeService {
  private client: S3Client;
  private bucket: string;
  private prisma: PrismaClient;

  constructor(options?: { s3Client?: S3Client; bucket?: string; prismaClient?: PrismaClient }) {
    this.bucket =
      options?.bucket ||
      process.env.R2_BUCKET_NAME ||
      process.env.S3_BUCKET ||
      'creatorconnect-media';
    this.prisma = options?.prismaClient || getPrismaClient();

    if (options?.s3Client) {
      this.client = options.s3Client;
    } else {
      const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
      const region = process.env.AWS_REGION || 'auto';
      const accessKeyId =
        process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'mock_key';
      const secretAccessKey =
        process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret';

      const clientConfig: any = {
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: true,
      };
      if (endpoint) {
        clientConfig.endpoint = endpoint;
      }
      this.client = new S3Client(clientConfig);
    }
  }

  /**
   * Purges all binary media assets, historical versions, delete markers, and incomplete multipart uploads.
   * Enforces strict user prefix isolation (only deletes keys belonging to the verified userId).
   */
  public async purgeUserAssets(userId: string): Promise<PurgeResult> {
    const userPrefix = `users/${userId}/`;
    const purgedKeys: string[] = [];
    let multipartUploadsAborted = 0;

    // 1. Collect all known database MediaAsset storage keys belonging to this user
    const dbAssets = await this.prisma.mediaAsset.findMany({
      where: { userId },
      select: { id: true, storageKey: true, thumbnailKey: true, previewKey: true },
    });

    const candidateKeys = new Set<string>();
    for (const asset of dbAssets) {
      candidateKeys.add(asset.storageKey);
      if (asset.thumbnailKey) candidateKeys.add(asset.thumbnailKey);
      if (asset.previewKey) candidateKeys.add(asset.previewKey);
      candidateKeys.add(`${asset.storageKey}.thumb`);
      candidateKeys.add(`${asset.storageKey}.preview`);
    }

    // 2. Enumerate versioned objects and delete markers under the user prefix
    try {
      let keyMarker: string | undefined = undefined;
      let versionIdMarker: string | undefined = undefined;
      let isTruncated = true;

      while (isTruncated) {
        const listCmd: ListObjectVersionsCommand = new ListObjectVersionsCommand({
          Bucket: this.bucket,
          Prefix: userPrefix,
          KeyMarker: keyMarker,
          VersionIdMarker: versionIdMarker,
          MaxKeys: 1000,
        });

        const listRes: any = await this.client.send(listCmd);
        const objectsToDelete: Array<{ Key: string; VersionId?: string }> = [];

        if (listRes.Versions) {
          for (const ver of listRes.Versions) {
            if (ver.Key) {
              objectsToDelete.push({ Key: ver.Key, VersionId: ver.VersionId });
              candidateKeys.add(ver.Key);
            }
          }
        }

        if (listRes.DeleteMarkers) {
          for (const marker of listRes.DeleteMarkers) {
            if (marker.Key) {
              objectsToDelete.push({ Key: marker.Key, VersionId: marker.VersionId });
              candidateKeys.add(marker.Key);
            }
          }
        }

        if (objectsToDelete.length > 0) {
          const deleteCmd = new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: objectsToDelete,
              Quiet: true,
            },
          });
          await this.client.send(deleteCmd);
          purgedKeys.push(...objectsToDelete.map((o) => `${o.Key} (v:${o.VersionId || 'latest'})`));
        }

        isTruncated = listRes.IsTruncated ?? false;
        keyMarker = listRes.NextKeyMarker;
        versionIdMarker = listRes.NextVersionIdMarker;
      }
    } catch (err: any) {
      // In non-versioned buckets, ListObjectVersions may fail; fall back to individual delete
      logger.warn(
        { err: err.message, userId },
        'ListObjectVersions unavailable or failed; proceeding with candidate key purge.',
      );
    }

    // 3. Purge candidate keys directly to ensure deletion regardless of versioning support
    for (const key of candidateKeys) {
      // Security Check: Key MUST start with userPrefix OR match database ownership
      const isOwnerPrefix = key.startsWith(userPrefix);
      const isDbOwnerKey = dbAssets.some((a) => key.startsWith(a.storageKey));

      if (isOwnerPrefix || isDbOwnerKey) {
        try {
          await this.client.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: key,
            }),
          );
          if (!purgedKeys.includes(key)) {
            purgedKeys.push(key);
          }
        } catch (err: any) {
          if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) {
            throw err;
          }
        }
      }
    }

    // 4. Abort incomplete multipart uploads under user prefix
    try {
      const listMultipart = new ListMultipartUploadsCommand({
        Bucket: this.bucket,
        Prefix: userPrefix,
      });
      const multipartRes = await this.client.send(listMultipart);

      if (multipartRes.Uploads) {
        for (const upload of multipartRes.Uploads) {
          if (upload.Key && upload.UploadId) {
            await this.client.send(
              new AbortMultipartUploadCommand({
                Bucket: this.bucket,
                Key: upload.Key,
                UploadId: upload.UploadId,
              }),
            );
            multipartUploadsAborted += 1;
          }
        }
      }
    } catch (err: any) {
      logger.warn(
        { err: err.message, userId },
        'Multipart upload enumeration unavailable or failed.',
      );
    }

    // 5. Remove or mark MediaAsset records in database
    await this.prisma.mediaAsset.deleteMany({
      where: { userId },
    });

    logger.info(
      {
        event: 'MEDIA_PURGED',
        userId,
        purgedCount: purgedKeys.length,
        multipartUploadsAborted,
      },
      'User media assets purged successfully from object storage.',
    );

    return {
      userId,
      purgedCount: purgedKeys.length,
      purgedKeys,
      multipartUploadsAborted,
    };
  }
}

/**
 * Isolated in-memory storage purge service for testing.
 */
export class MockStoragePurgeService implements IExternalStoragePurgeService {
  public storedObjects = new Map<string, { buffer: Buffer; versions?: string[] }>();
  public activeMultipartUploads = new Map<string, string>(); // key -> uploadId

  public async purgeUserAssets(userId: string): Promise<PurgeResult> {
    const userPrefix = `users/${userId}/`;
    const purgedKeys: string[] = [];
    let multipartUploadsAborted = 0;

    for (const [key] of this.storedObjects.entries()) {
      if (key.startsWith(userPrefix) || key.includes(userId)) {
        this.storedObjects.delete(key);
        purgedKeys.push(key);
      }
    }

    for (const [key] of this.activeMultipartUploads.entries()) {
      if (key.startsWith(userPrefix) || key.includes(userId)) {
        this.activeMultipartUploads.delete(key);
        multipartUploadsAborted += 1;
      }
    }

    return {
      userId,
      purgedCount: purgedKeys.length,
      purgedKeys,
      multipartUploadsAborted,
    };
  }
}

export const externalStoragePurgeService = new S3StoragePurgeAdapter();
