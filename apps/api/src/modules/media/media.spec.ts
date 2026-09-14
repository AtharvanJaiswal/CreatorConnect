import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';
import { mediaService } from './media.service.js';
import { MockStorageService } from './storage.service.js';

describe('Media Domain Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();
  const mockStorage = new MockStorageService();

  let creatorUserId: string;
  let creatorToken: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    // Inject mock storage service into mediaService
    (mediaService as any).storage = mockStorage;

    app = await buildApp();
    await app.ready();

    creatorUserId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_media_${Date.now()}_${generateUuidV7()}`,
      email: `media_test_${Date.now()}_${generateUuidV7()}@test.com`,
    });
    const decoded: any = await defaultJwtVerifier.verifyToken(creatorToken);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: decoded.sub,
        email: decoded.email,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'CREATOR' },
                create: { id: generateUuidV7(), name: 'CREATOR' },
              },
            },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('generates server-authoritative upload URL with quarantine storage key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        originalName: 'profile_shot.png',
        mimeType: 'image/png',
        byteSize: 1024,
        mediaType: 'IMAGE',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.storageKey).toMatch(new RegExp(`^quarantine/${creatorUserId}/[0-9a-f-]+\\.png$`));
    expect(body.uploadUrl).toBeDefined();

    // Verify DB record status is QUARANTINED
    const asset = await prisma.mediaAsset.findUnique({ where: { id: body.assetId } });
    expect(asset).toBeDefined();
    expect(asset?.status).toBe('QUARANTINED');
  });

  it('rejects confirmation with 400 UPLOAD_SIZE_MISMATCH when uploaded byte size deviates', async () => {
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        byteSize: 2048,
        mediaType: 'IMAGE',
      },
    });
    const { assetId, storageKey } = initRes.json();

    // Mock storage object with wrong size (e.g. 1000 bytes instead of 2048)
    mockStorage.objects.set(storageKey, {
      buffer: Buffer.alloc(1000),
      contentType: 'image/jpeg',
    });

    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-confirm',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { assetId },
    });

    expect(confirmRes.statusCode).toBe(400);
    const body = confirmRes.json();
    expect(body.code).toBe('UPLOAD_SIZE_MISMATCH');

    // Verify DB status is transitioned to REJECTED_INVALID
    const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    expect(asset?.status).toBe('REJECTED_INVALID');
  });

  it('confirms valid upload and transitions status to PENDING_SCAN', async () => {
    const initRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-url',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        originalName: 'photo.webp',
        mimeType: 'image/webp',
        byteSize: 4096,
        mediaType: 'IMAGE',
      },
    });
    const { assetId, storageKey } = initRes.json();

    // Mock storage object with exact byte match
    mockStorage.objects.set(storageKey, {
      buffer: Buffer.alloc(4096),
      contentType: 'image/webp',
    });

    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-confirm',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { assetId },
    });

    expect(confirmRes.statusCode).toBe(200);
    const body = confirmRes.json();
    expect(body.status).toBe('PENDING_SCAN');

    // Repeated confirmation is idempotent
    const repeatRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-confirm',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { assetId },
    });
    expect(repeatRes.statusCode).toBe(200);
    expect(repeatRes.json().status).toBe('PENDING_SCAN');
  });
});
