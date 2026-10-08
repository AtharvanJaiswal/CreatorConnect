import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
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
    // Non-ACTIVE asset must receive null for all URLs
    expect(body.url).toBeNull();
    expect(body.thumbnailUrl).toBeNull();
    expect(body.previewUrl).toBeNull();

    // Repeated confirmation is idempotent
    const repeatRes = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload-confirm',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { assetId },
    });
    expect(repeatRes.statusCode).toBe(200);
    expect(repeatRes.json().status).toBe('PENDING_SCAN');
    expect(repeatRes.json().url).toBeNull();
  });

  it('proves inactive media states (QUARANTINED, PENDING_SCAN, REJECTED_INVALID) never expose download URLs', async () => {
    // 1. QUARANTINED asset
    const qAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: qAssetId,
        userId: creatorUserId,
        storageKey: `quarantine/${creatorUserId}/${qAssetId}.png`,
        originalName: 'secret.png',
        mimeType: 'image/png',
        byteSize: 100,
        mediaType: 'IMAGE',
        status: 'QUARANTINED',
      },
    });

    const qRes = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${qAssetId}`,
      headers: { authorization: `Bearer ${creatorToken}` },
    });
    expect(qRes.statusCode).toBe(200);
    const qBody = qRes.json();
    expect(qBody.status).toBe('QUARANTINED');
    expect(qBody.url).toBeNull();
    expect(qBody.thumbnailUrl).toBeNull();
    expect(qBody.previewUrl).toBeNull();

    // 2. REJECTED_INVALID asset
    const rAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: rAssetId,
        userId: creatorUserId,
        storageKey: `quarantine/${creatorUserId}/${rAssetId}.png`,
        originalName: 'malware.png',
        mimeType: 'image/png',
        byteSize: 100,
        mediaType: 'IMAGE',
        status: 'REJECTED_INVALID',
      },
    });

    const rRes = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${rAssetId}`,
      headers: { authorization: `Bearer ${creatorToken}` },
    });
    expect(rRes.statusCode).toBe(200);
    const rBody = rRes.json();
    expect(rBody.status).toBe('REJECTED_INVALID');
    expect(rBody.url).toBeNull();
    expect(rBody.thumbnailUrl).toBeNull();
    expect(rBody.previewUrl).toBeNull();

    // 3. ACTIVE asset generates valid presigned URLs
    const aAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: aAssetId,
        userId: creatorUserId,
        storageKey: `public-assets/${creatorUserId}/${aAssetId}.png`,
        thumbnailKey: `public-assets/${creatorUserId}/${aAssetId}_thumb.webp`,
        previewKey: `public-assets/${creatorUserId}/${aAssetId}_preview.webp`,
        originalName: 'hero.png',
        mimeType: 'image/png',
        byteSize: 500,
        mediaType: 'IMAGE',
        status: 'ACTIVE',
      },
    });

    const aRes = await app.inject({
      method: 'GET',
      url: `/api/v1/media/${aAssetId}`,
      headers: { authorization: `Bearer ${creatorToken}` },
    });
    expect(aRes.statusCode).toBe(200);
    const aBody = aRes.json();
    expect(aBody.status).toBe('ACTIVE');
    expect(typeof aBody.url).toBe('string');
    expect(aBody.url).toContain(`public-assets/${creatorUserId}/${aAssetId}.png`);
    expect(typeof aBody.thumbnailUrl).toBe('string');
    expect(typeof aBody.previewUrl).toBe('string');
  });

  describe('Media Authorization & Inheritance Policy (F-25)', () => {
    let otherUserId: string;
    let otherToken: string;

    beforeAll(async () => {
      otherUserId = generateUuidV7();
      otherToken = await createTestJwt({
        sub: `sub_other_${Date.now()}_${generateUuidV7()}`,
        email: `other_${Date.now()}_${generateUuidV7()}@test.com`,
      });
      const decoded: any = await defaultJwtVerifier.verifyToken(otherToken);
      await prisma.user.create({
        data: {
          id: otherUserId,
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

    it('rejects unrelated user from accessing unattached active media (403 Forbidden)', async () => {
      const assetId = generateUuidV7();
      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: creatorUserId,
          storageKey: `public-assets/${creatorUserId}/${assetId}.png`,
          originalName: 'unattached.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      // Unrelated user cannot access unattached active asset
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows owner to access unattached active media with private signed URL', async () => {
      const assetId = generateUuidV7();
      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: creatorUserId,
          storageKey: `public-assets/${creatorUserId}/${assetId}.png`,
          originalName: 'unattached_owner.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.url).toBeDefined();
    });

    it('allows unrelated user to view media attached to a PUBLIC portfolio item', async () => {
      const assetId = generateUuidV7();
      const portfolioItemId = generateUuidV7();

      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: creatorUserId,
          storageKey: `public-assets/${creatorUserId}/${assetId}.png`,
          originalName: 'public_work.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      await prisma.portfolioItem.create({
        data: {
          id: portfolioItemId,
          userId: creatorUserId,
          title: 'Public Artwork',
          visibility: 'PUBLIC',
          media: {
            create: {
              id: generateUuidV7(),
              mediaAssetId: assetId,
              displayOrder: 0,
            },
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.url).toBeDefined();
    });

    it('rejects unrelated user from viewing media attached to a PRIVATE portfolio item (403)', async () => {
      const assetId = generateUuidV7();
      const portfolioItemId = generateUuidV7();

      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: creatorUserId,
          storageKey: `public-assets/${creatorUserId}/${assetId}.png`,
          originalName: 'confidential_work.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      await prisma.portfolioItem.create({
        data: {
          id: portfolioItemId,
          userId: creatorUserId,
          title: 'Confidential Internal Artwork',
          visibility: 'PRIVATE',
          media: {
            create: {
              id: generateUuidV7(),
              mediaAssetId: assetId,
              displayOrder: 0,
            },
          },
        },
      });

      // Unrelated user cannot view
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(403);

      // Owner CAN view
      const ownerRes = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(ownerRes.statusCode).toBe(200);
      expect(ownerRes.json().url).toBeDefined();
    });

    it('allows unrelated user to view media attached to an UNLISTED portfolio item', async () => {
      const assetId = generateUuidV7();
      const portfolioItemId = generateUuidV7();

      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: creatorUserId,
          storageKey: `public-assets/${creatorUserId}/${assetId}.png`,
          originalName: 'unlisted_work.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      await prisma.portfolioItem.create({
        data: {
          id: portfolioItemId,
          userId: creatorUserId,
          title: 'Direct Link Unlisted Project',
          visibility: 'UNLISTED',
          media: {
            create: {
              id: generateUuidV7(),
              mediaAssetId: assetId,
              displayOrder: 0,
            },
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('rejects access when parent portfolio item is deleted (403 for non-owner)', async () => {
      const assetId = generateUuidV7();
      const portfolioItemId = generateUuidV7();

      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: creatorUserId,
          storageKey: `public-assets/${creatorUserId}/${assetId}.png`,
          originalName: 'deleted_parent_work.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      await prisma.portfolioItem.create({
        data: {
          id: portfolioItemId,
          userId: creatorUserId,
          title: 'Deleted Parent Project',
          visibility: 'PUBLIC',
          deletedAt: new Date(),
          media: {
            create: {
              id: generateUuidV7(),
              mediaAssetId: assetId,
              displayOrder: 0,
            },
          },
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('rejects all access when owner user account is SUSPENDED (403)', async () => {
      const suspendedUserId = generateUuidV7();
      const suspendedToken = await createTestJwt({
        sub: `sub_susp_${Date.now()}_${generateUuidV7()}`,
        email: `susp_${Date.now()}_${generateUuidV7()}@test.com`,
      });
      const decoded: any = await defaultJwtVerifier.verifyToken(suspendedToken);
      await prisma.user.create({
        data: {
          id: suspendedUserId,
          supabaseAuthId: decoded.sub,
          email: decoded.email,
          status: 'SUSPENDED',
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

      const assetId = generateUuidV7();
      await prisma.mediaAsset.create({
        data: {
          id: assetId,
          userId: suspendedUserId,
          storageKey: `public-assets/${suspendedUserId}/${assetId}.png`,
          originalName: 'suspended_asset.png',
          mimeType: 'image/png',
          byteSize: 500,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/media/${assetId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
