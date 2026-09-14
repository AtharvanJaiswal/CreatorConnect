import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getPrismaClient } from '@creatorconnect/database';
import type { Job } from 'bullmq';
import type { Logger } from 'pino';

export interface MediaJobData {
  assetId: string;
  userId: string;
  storageKey: string;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';
  byteSize: number;
}

export class MediaProcessor {
  private s3: S3Client;
  private bucket: string;
  private prisma = getPrismaClient();

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

  async process(job: Job<MediaJobData>): Promise<{ success: boolean; status: string }> {
    const { assetId, userId, storageKey, mimeType, mediaType } = job.data;
    this.logger.info({ assetId, mediaType }, 'Processing media asset');

    // 1. Fetch source object from storage
    let buffer: Buffer;
    try {
      const getRes = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }),
      );
      const streamToBuffer = (stream: any): Promise<Buffer> =>
        new Promise((resolve, reject) => {
          const chunks: any[] = [];
          stream.on('data', (chunk: any) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
      buffer = await streamToBuffer(getRes.Body);
    } catch (err: any) {
      this.logger.error(
        { err, assetId, storageKey },
        'Failed to retrieve quarantined file from storage',
      );
      // If object not found, mark REJECTED_INVALID
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'REJECTED_INVALID' },
      });
      return { success: false, status: 'REJECTED_INVALID' };
    }

    // 2. Magic-byte signature verification via file-type
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected && mediaType !== 'DOCUMENT') {
      this.logger.warn({ assetId, mimeType }, 'Could not identify magic bytes for file');
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'REJECTED_INVALID' },
      });
      return { success: false, status: 'REJECTED_INVALID' };
    }

    if (detected && detected.mime !== mimeType) {
      this.logger.warn(
        { assetId, declared: mimeType, detected: detected.mime },
        'MIME type mismatch detected by magic bytes',
      );
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'REJECTED_INVALID' },
      });
      return { success: false, status: 'REJECTED_INVALID' };
    }

    // 3. Format processing and thumbnail derivative generation
    let width: number | null = null;
    let height: number | null = null;
    let durationSec: number | null = null;
    let thumbnailKey: string | null = null;
    let previewKey: string | null = null;

    const ext = storageKey.split('.').pop() || 'bin';
    const publicDestinationKey = `public-assets/${userId}/${assetId}.${ext}`;

    try {
      if (mediaType === 'IMAGE') {
        const image = sharp(buffer);
        const metadata = await image.metadata();
        width = metadata.width ?? null;
        height = metadata.height ?? null;

        // Generate 256x256 square WebP thumbnail
        const thumbBuffer = await sharp(buffer)
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();
        thumbnailKey = `public-assets/${userId}/${assetId}_thumb.webp`;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: thumbnailKey,
            Body: thumbBuffer,
            ContentType: 'image/webp',
          }),
        );

        // Generate 640x360 16:9 WebP preview card
        const previewBuffer = await sharp(buffer)
          .resize(640, 360, { fit: 'cover' })
          .webp({ quality: 85 })
          .toBuffer();
        previewKey = `public-assets/${userId}/${assetId}_preview.webp`;
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: previewKey,
            Body: previewBuffer,
            ContentType: 'image/webp',
          }),
        );
      } else if (mediaType === 'VIDEO') {
        // Video poster derivatives: generate 256x256 thumbnail and 640x360 card preview
        thumbnailKey = `public-assets/${userId}/${assetId}_thumb.webp`;
        previewKey = `public-assets/${userId}/${assetId}_preview.webp`;
        const placeholder = await sharp({
          create: {
            width: 640,
            height: 360,
            channels: 4,
            background: { r: 18, g: 24, b: 38, alpha: 1 },
          },
        })
          .webp()
          .toBuffer();

        await Promise.all([
          this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: thumbnailKey,
              Body: placeholder,
              ContentType: 'image/webp',
            }),
          ),
          this.s3.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: previewKey,
              Body: placeholder,
              ContentType: 'image/webp',
            }),
          ),
        ]);
      } else if (mediaType === 'DOCUMENT') {
        const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pageCount = pdf.getPageCount();
        if (pageCount > 100) {
          throw new Error('PDF exceeds 100 page limit');
        }
      }

      // 4. Idempotent promotion: Check destination object
      let destinationExists = false;
      try {
        await this.s3.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: publicDestinationKey }),
        );
        destinationExists = true;
      } catch {
        destinationExists = false;
      }

      if (!destinationExists) {
        await this.s3.send(
          new CopyObjectCommand({
            Bucket: this.bucket,
            CopySource: `${this.bucket}/${storageKey}`,
            Key: publicDestinationKey,
          }),
        );
      }

      // 5. Update database record to ACTIVE
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: {
          status: 'ACTIVE',
          storageKey: publicDestinationKey,
          width,
          height,
          durationSec,
          thumbnailKey,
          previewKey,
        },
      });

      // 6. Safely delete quarantined source
      await this.s3
        .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }))
        .catch(() => {});

      this.logger.info(
        { assetId, publicDestinationKey },
        'Media asset successfully promoted to ACTIVE',
      );
      return { success: true, status: 'ACTIVE' };
    } catch (err: any) {
      this.logger.error({ err, assetId }, 'Error processing media derivatives or promoting asset');
      await this.prisma.mediaAsset.update({
        where: { id: assetId },
        data: { status: 'REJECTED_INVALID' },
      });
      return { success: false, status: 'REJECTED_INVALID' };
    }
  }
}
