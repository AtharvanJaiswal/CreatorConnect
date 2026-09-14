import { getPrismaClient } from '@creatorconnect/database';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Queue } from 'bullmq';
import type { Logger } from 'pino';

export class CleanupScheduler {
  private prisma = getPrismaClient();
  private s3: S3Client;
  private bucket: string;

  constructor(private logger: Logger) {
    const endpoint = process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
    const region = process.env.AWS_REGION || 'auto';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'mock_key';
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret';
    this.bucket = process.env.R2_BUCKET_NAME || 'creatorconnect-media';

    const clientConfig: any = {
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    };
    if (endpoint) clientConfig.endpoint = endpoint;
    this.s3 = new S3Client(clientConfig);
  }

  async cleanupExpiredQuarantine(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.mediaAsset.findMany({
      where: {
        status: 'QUARANTINED',
        expiresAt: { lt: now },
      },
      take: 100,
    });

    for (const asset of expired) {
      try {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.storageKey }));
      } catch (err) {
        this.logger.warn(
          { err, key: asset.storageKey },
          'Failed to delete expired quarantine object from S3',
        );
      }

      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: 'DELETED' },
      });
    }

    if (expired.length > 0) {
      this.logger.info({ count: expired.length }, 'Cleaned up expired quarantined uploads');
    }
    return expired.length;
  }

  async reconcileStalePendingScan(queue?: Queue): Promise<number> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stale = await this.prisma.mediaAsset.findMany({
      where: {
        status: 'PENDING_SCAN',
        updatedAt: { lt: thirtyMinutesAgo },
      },
      take: 50,
    });

    if (queue && stale.length > 0) {
      for (const asset of stale) {
        await queue.add(
          'media-scan-and-process',
          {
            assetId: asset.id,
            userId: asset.userId,
            storageKey: asset.storageKey,
            mimeType: asset.mimeType,
            mediaType: asset.mediaType,
            byteSize: asset.byteSize,
          },
          { jobId: asset.id, attempts: 3, removeOnComplete: true },
        );
      }
      this.logger.info({ count: stale.length }, 'Re-enqueued stale PENDING_SCAN media assets');
    }
    return stale.length;
  }

  async closeExpiredAssignments(): Promise<number> {
    const res = await this.prisma.assignment.updateMany({
      where: {
        status: 'PUBLISHED',
        deadline: { lte: new Date() },
      },
      data: {
        status: 'CLOSED',
      },
    });

    if (res.count > 0) {
      this.logger.info({ count: res.count }, 'Closed expired published assignments');
    }
    return res.count;
  }
}
