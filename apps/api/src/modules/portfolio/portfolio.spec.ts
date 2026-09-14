import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';

describe('Portfolio Domain Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let creatorUserId: string;
  let creatorToken: string;
  let otherUserId: string;
  let otherToken: string;

  let quarantinedAssetId: string;
  let activeAssetId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    creatorUserId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_c_${generateUuidV7().replace(/-/g, '')}`,
      email: `c_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedCreator: any = await defaultJwtVerifier.verifyToken(creatorToken);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: decodedCreator.sub,
        email: decodedCreator.email,
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

    otherUserId = generateUuidV7();
    otherToken = await createTestJwt({
      sub: `sub_o_${generateUuidV7().replace(/-/g, '')}`,
      email: `o_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedOther: any = await defaultJwtVerifier.verifyToken(otherToken);
    await prisma.user.create({
      data: {
        id: otherUserId,
        supabaseAuthId: decodedOther.sub,
        email: decodedOther.email,
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

    // Create a quarantined asset
    quarantinedAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: quarantinedAssetId,
        userId: creatorUserId,
        storageKey: `quarantine/${creatorUserId}/${quarantinedAssetId}.png`,
        originalName: 'draft.png',
        mimeType: 'image/png',
        byteSize: 100,
        mediaType: 'IMAGE',
        status: 'QUARANTINED',
      },
    });

    // Create an active asset
    activeAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: activeAssetId,
        userId: creatorUserId,
        storageKey: `public-assets/${creatorUserId}/${activeAssetId}.png`,
        originalName: 'final.png',
        mimeType: 'image/png',
        byteSize: 200,
        mediaType: 'IMAGE',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a new portfolio item for authenticated creator', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/portfolio/items',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        title: 'Brand Campaign 2026',
        description: 'Multi-episode YouTube documentary series.',
        externalUrl: 'https://youtube.com/watch?v=123',
        displayOrder: 1,
        visibility: 'PUBLIC',
        tags: ['Documentary', 'Editing'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Brand Campaign 2026');
    expect(body.displayOrder).toBe(1);
  });

  it('prohibits attaching QUARANTINED media asset to portfolio item', async () => {
    const itemRes = await app.inject({
      method: 'POST',
      url: '/api/v1/portfolio/items',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { title: 'Item for Quarantine Test' },
    });
    const itemId = itemRes.json().id;

    const attachRes = await app.inject({
      method: 'POST',
      url: `/api/v1/portfolio/items/${itemId}/media`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { mediaAssetId: quarantinedAssetId },
    });

    expect(attachRes.statusCode).toBe(400);
    expect(attachRes.json().code).toBe('INVALID_MEDIA_STATE');
  });

  it('attaches ACTIVE media asset and rejects duplicate attachment with 409 Conflict', async () => {
    const itemRes = await app.inject({
      method: 'POST',
      url: '/api/v1/portfolio/items',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { title: 'Item for Duplicate Test' },
    });
    const itemId = itemRes.json().id;

    // First attachment succeeds
    const attach1 = await app.inject({
      method: 'POST',
      url: `/api/v1/portfolio/items/${itemId}/media`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { mediaAssetId: activeAssetId, displayOrder: 0, caption: 'Main Shot' },
    });
    expect(attach1.statusCode).toBe(201);

    // Duplicate attachment of same media asset rejected with 409
    const attach2 = await app.inject({
      method: 'POST',
      url: `/api/v1/portfolio/items/${itemId}/media`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { mediaAssetId: activeAssetId },
    });
    expect(attach2.statusCode).toBe(409);
    expect(attach2.json().code).toBe('CONFLICT');
  });

  it('prevents IDOR: user cannot edit or delete another user portfolio item', async () => {
    const itemRes = await app.inject({
      method: 'POST',
      url: '/api/v1/portfolio/items',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { title: 'Creator Protected Item' },
    });
    const itemId = itemRes.json().id;

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/v1/portfolio/items/${itemId}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { title: 'Hacked Title' },
    });
    expect(updateRes.statusCode).toBe(403);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/portfolio/items/${itemId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(deleteRes.statusCode).toBe(403);
  });
});
