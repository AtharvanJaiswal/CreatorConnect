import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageHeadResult {
  contentLength: number;
  contentType?: string | undefined;
}

export interface IStorageService {
  generateUploadUrl(
    key: string,
    contentType: string,
    byteSize: number,
    expiresInSeconds?: number,
  ): Promise<string>;
  getHeadObject(key: string): Promise<StorageHeadResult | null>;
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
}

export class S3StorageService implements IStorageService {
  private client: S3Client;
  private bucket: string;

  constructor(options?: {
    endpoint?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket?: string;
  }) {
    const endpoint = options?.endpoint || process.env.R2_ENDPOINT || process.env.S3_ENDPOINT;
    const region = options?.region || process.env.AWS_REGION || 'auto';
    const accessKeyId =
      options?.accessKeyId ||
      process.env.R2_ACCESS_KEY_ID ||
      process.env.AWS_ACCESS_KEY_ID ||
      'mock_key';
    const secretAccessKey =
      options?.secretAccessKey ||
      process.env.R2_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY ||
      'mock_secret';
    this.bucket = options?.bucket || process.env.R2_BUCKET_NAME || 'creatorconnect-media';

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

  async generateUploadUrl(
    key: string,
    contentType: string,
    byteSize: number,
    expiresInSeconds = 900,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: byteSize,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getHeadObject(key: string): Promise<StorageHeadResult | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType,
      };
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  async getDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const publicDomain = process.env.MEDIA_CDN_URL;
    if (publicDomain && !key.startsWith('quarantine/')) {
      return `${publicDomain.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const command = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    });
    await this.client.send(command);
  }
}

/**
 * In-memory Mock Storage Service for isolated unit and integration testing.
 */
export class MockStorageService implements IStorageService {
  public objects = new Map<string, { buffer: Buffer; contentType: string }>();

  async generateUploadUrl(key: string): Promise<string> {
    return `https://mock-storage.local/upload/${key}`;
  }

  async getHeadObject(key: string): Promise<StorageHeadResult | null> {
    const obj = this.objects.get(key);
    if (!obj) return null;
    return {
      contentLength: obj.buffer.length,
      contentType: obj.contentType,
    };
  }

  async getDownloadUrl(key: string): Promise<string> {
    return `https://mock-storage.local/download/${key}`;
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    const source = this.objects.get(sourceKey);
    if (source) {
      this.objects.set(destinationKey, { ...source });
    }
  }
}
