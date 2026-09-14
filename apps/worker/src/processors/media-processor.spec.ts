import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaProcessor } from './media-processor.js';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import pino from 'pino';

// Mock AWS S3 Client
vi.mock('@aws-sdk/client-s3', () => {
  class MockGetObjectCommand {
    type = 'GetObjectCommand';
    constructor(public input: any) {}
  }
  class MockPutObjectCommand {
    type = 'PutObjectCommand';
    constructor(public input: any) {}
  }
  class MockDeleteObjectCommand {
    type = 'DeleteObjectCommand';
    constructor(public input: any) {}
  }
  class MockHeadObjectCommand {
    type = 'HeadObjectCommand';
    constructor(public input: any) {}
  }
  class MockCopyObjectCommand {
    type = 'CopyObjectCommand';
    constructor(public input: any) {}
  }

  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
    GetObjectCommand: MockGetObjectCommand,
    PutObjectCommand: MockPutObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
    HeadObjectCommand: MockHeadObjectCommand,
    CopyObjectCommand: MockCopyObjectCommand,
  };
});

// Mock Prisma
const mockPrismaUpdate = vi.fn();
vi.mock('@creatorconnect/database', () => ({
  getPrismaClient: () => ({
    mediaAsset: {
      update: mockPrismaUpdate,
    },
  }),
}));

describe('MediaProcessor Unit Tests', () => {
  const logger = pino({ level: 'silent' });
  let processor: MediaProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new MediaProcessor(logger);
  });

  it('successfully processes valid image and generates derivatives', async () => {
    // Generate valid 100x100 PNG
    const validPng = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const mockReadableStream = {
      on: (event: string, callback: any) => {
        if (event === 'data') callback(validPng);
        if (event === 'end') callback();
        return mockReadableStream;
      },
    };

    (processor as any).s3.send = vi.fn().mockImplementation(async (command: any) => {
      if (command.type === 'GetObjectCommand') {
        return { Body: mockReadableStream };
      }
      if (command.type === 'HeadObjectCommand') {
        throw new Error('NotFound');
      }
      return {};
    });

    const job: any = {
      data: {
        assetId: 'asset-123',
        userId: 'user-123',
        storageKey: 'quarantine/user-123/asset-123.png',
        mimeType: 'image/png',
        mediaType: 'IMAGE',
        byteSize: validPng.length,
      },
    };

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-123' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          width: 100,
          height: 100,
        }),
      }),
    );
  });

  it('rejects image when mime type does not match magic bytes', async () => {
    // Generate valid PNG but claim it is JPEG
    const validPng = await sharp({
      create: {
        width: 50,
        height: 50,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const mockReadableStream = {
      on: (event: string, callback: any) => {
        if (event === 'data') callback(validPng);
        if (event === 'end') callback();
        return mockReadableStream;
      },
    };

    (processor as any).s3.send = vi.fn().mockResolvedValue({ Body: mockReadableStream });

    const job: any = {
      data: {
        assetId: 'asset-spoofed',
        userId: 'user-123',
        storageKey: 'quarantine/user-123/asset-spoofed.jpg',
        mimeType: 'image/jpeg', // Mismatch! Real is image/png
        mediaType: 'IMAGE',
        byteSize: validPng.length,
      },
    };

    const result = await processor.process(job);
    expect(result.success).toBe(false);
    expect(result.status).toBe('REJECTED_INVALID');
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-spoofed' },
        data: { status: 'REJECTED_INVALID' },
      }),
    );
  });

  it('validates and accepts valid PDF document', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([200, 200]);
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);

    const mockReadableStream = {
      on: (event: string, callback: any) => {
        if (event === 'data') callback(pdfBuffer);
        if (event === 'end') callback();
        return mockReadableStream;
      },
    };

    (processor as any).s3.send = vi.fn().mockImplementation(async (command: any) => {
      if (command.type === 'GetObjectCommand') {
        return { Body: mockReadableStream };
      }
      if (command.type === 'HeadObjectCommand') {
        throw new Error('NotFound');
      }
      return {};
    });

    const job: any = {
      data: {
        assetId: 'asset-pdf',
        userId: 'user-123',
        storageKey: 'quarantine/user-123/asset-pdf.pdf',
        mimeType: 'application/pdf',
        mediaType: 'DOCUMENT',
        byteSize: pdfBuffer.length,
      },
    };

    const result = await processor.process(job);
    expect(result.success).toBe(true);
    expect(result.status).toBe('ACTIVE');
  });
});
