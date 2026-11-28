import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Phase 3A: Community Hub, Events & Moderation Integration Endpoints', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let creatorUserId: string;
  let creatorToken: string;

  let memberUserId: string;
  let memberToken: string;

  let adminUserId: string;
  let adminToken: string;

  let testPostId: string;
  let testEventId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Creator User
    creatorUserId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_comm_creator_${generateUuidV7().replace(/-/g, '')}`,
      email: `comm_creator_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedCreator: any = await defaultJwtVerifier.verifyToken(creatorToken);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: decodedCreator.sub,
        email: decodedCreator.email,
        firstName: 'Aarav',
        lastName: 'Mehta',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'CREATOR' } },
          },
        },
        creatorProfile: {
          create: {
            id: generateUuidV7(),
            tagline: 'Director of Photography',
            currency: 'INR',
            isVerified: true,
            locationCity: 'Mumbai',
          },
        },
      },
    });

    // 2. Member User
    memberUserId = generateUuidV7();
    memberToken = await createTestJwt({
      sub: `sub_comm_member_${generateUuidV7().replace(/-/g, '')}`,
      email: `comm_member_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedMember: any = await defaultJwtVerifier.verifyToken(memberToken);
    await prisma.user.create({
      data: {
        id: memberUserId,
        supabaseAuthId: decodedMember.sub,
        email: decodedMember.email,
        firstName: 'Priya',
        lastName: 'Sharma',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'PROFESSIONAL' } },
          },
        },
      },
    });

    // 3. Admin User
    adminUserId = generateUuidV7();
    adminToken = await createTestJwt({
      sub: `sub_comm_admin_${generateUuidV7().replace(/-/g, '')}`,
      email: `comm_admin_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedAdmin: any = await defaultJwtVerifier.verifyToken(adminToken);
    await prisma.user.create({
      data: {
        id: adminUserId,
        supabaseAuthId: decodedAdmin.sub,
        email: decodedAdmin.email,
        firstName: 'Security',
        lastName: 'Admin',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'ADMIN' } },
          },
        },
        adminUserRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'TRUST_SAFETY_ADMIN' } },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ==============================================================================
  // Post Creation & Retrieval Tests
  // ==============================================================================

  it('rejects unauthenticated post creation with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/community/posts',
      payload: {
        title: 'Unauthorized post attempt',
        body: 'This should fail authentication guard.',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid post payloads with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/community/posts',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        title: 'Hi', // Too short (min 3)
        body: 'Short', // Too short (min 10)
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('creates a community post successfully and publishes outbox event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/community/posts',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        title: 'Mumbai Indie Filmmakers Monsoon Gear Pooling & Rental Tips',
        body: 'Looking to connect with local DP crews in Bandra for gear sharing and cinema camera tests.',
        type: 'DISCUSSION',
        city: 'Mumbai',
        tags: ['Gear', 'Bandra', 'Film'],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.title).toContain('Mumbai Indie Filmmakers');
    expect(body.author.name).toBe('Aarav Mehta');
    expect(body.author.isVerified).toBe(true);
    expect(body.applaudsCount).toBe(0);
    expect(body.commentsCount).toBe(0);

    testPostId = body.id;

    // Verify outbox record
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: testPostId,
        eventType: 'community.post.created.v1',
      },
    });
    expect(outbox).not.toBeNull();
    expect(outbox?.status).toBe('PENDING');
  });

  it('retrieves community feed posts with city and type filter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/community/posts?city=Mumbai&type=DISCUSSION',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);

    const post = body.items.find((p: any) => p.id === testPostId);
    expect(post).toBeDefined();
    expect(post.city).toBe('Mumbai');
  });

  it('retrieves a single community post by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/community/posts/${testPostId}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(testPostId);
    expect(body.title).toContain('Mumbai Indie Filmmakers');
  });

  it('returns 404 for nonexistent community post', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/community/posts/${generateUuidV7()}`,
    });

    expect(res.statusCode).toBe(404);
  });

  // ==============================================================================
  // Applaud Idempotency Tests
  // ==============================================================================

  it('applauds a post idempotently (toggle ON and OFF)', async () => {
    // 1. Toggle ON
    const applaudRes = await app.inject({
      method: 'POST',
      url: `/api/v1/community/posts/${testPostId}/applaud`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(applaudRes.statusCode).toBe(200);
    expect(applaudRes.json().applauded).toBe(true);
    expect(applaudRes.json().applaudsCount).toBe(1);

    // Verify DB
    const dbPost = await prisma.communityPost.findUnique({
      where: { id: testPostId },
      select: { applaudsCount: true },
    });
    expect(dbPost?.applaudsCount).toBe(1);

    // 2. Toggle OFF (same user applauds again)
    const unapplaudRes = await app.inject({
      method: 'POST',
      url: `/api/v1/community/posts/${testPostId}/applaud`,
      headers: { authorization: `Bearer ${memberToken}` },
    });
    expect(unapplaudRes.statusCode).toBe(200);
    expect(unapplaudRes.json().applauded).toBe(false);
    expect(unapplaudRes.json().applaudsCount).toBe(0);
  });

  // ==============================================================================
  // Threaded Comments Tests
  // ==============================================================================

  it('creates and lists threaded replies for a community post', async () => {
    const replyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/community/posts/${testPostId}/comments`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        content: 'I have a Ronin 4D 4-lens set in Bandra West available for weekend shoots.',
      },
    });

    expect(replyRes.statusCode).toBe(201);
    const replyBody = replyRes.json();
    expect(replyBody.id).toBeDefined();
    expect(replyBody.author.name).toBe('Priya Sharma');
    expect(replyBody.content).toContain('Ronin 4D 4-lens set');

    // Verify outbox
    const replyOutbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: replyBody.id,
        eventType: 'community.reply.created.v1',
      },
    });
    expect(replyOutbox).not.toBeNull();

    // Verify comment list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/community/posts/${testPostId}/comments`,
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.length).toBeGreaterThanOrEqual(1);
    expect(listRes.json().items[0].content).toContain('Ronin 4D');
  });

  // ==============================================================================
  // Events & RSVP Idempotency Tests
  // ==============================================================================

  it('creates a community event successfully and lists it in feed', async () => {
    const createEventRes = await app.inject({
      method: 'POST',
      url: '/api/v1/community/events',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        title: 'Monsoon Creators Mixer at Bandra Base',
        description: 'Live gear testing, networking and cinematography masterclass.',
        city: 'Mumbai',
        venue: 'Bandra Base, 29th Road, Bandra West',
        eventDate: new Date(Date.now() + 86400000 * 7).toISOString(),
        capacity: 50,
        isOfficial: true,
      },
    });

    expect(createEventRes.statusCode).toBe(201);
    const eventBody = createEventRes.json();
    expect(eventBody.id).toBeDefined();
    expect(eventBody.title).toContain('Monsoon Creators Mixer');
    expect(eventBody.capacity).toBe(50);
    expect(eventBody.rsvpCount).toBe(0);

    testEventId = eventBody.id;

    // List events
    const listEventsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/community/events?city=Mumbai',
    });
    expect(listEventsRes.statusCode).toBe(200);
    expect(listEventsRes.json().items.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces RSVP idempotency across repeated and cancel requests', async () => {
    // 1. Initial RSVP
    const rsvp1 = await app.inject({
      method: 'POST',
      url: `/api/v1/community/events/${testEventId}/rsvp`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { status: 'CONFIRMED' },
    });
    expect(rsvp1.statusCode).toBe(200);
    expect(rsvp1.json().status).toBe('CONFIRMED');
    expect(rsvp1.json().rsvpCount).toBe(1);

    // 2. Duplicate RSVP for same event & user -> Idempotent no-op
    const rsvpDuplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/community/events/${testEventId}/rsvp`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { status: 'CONFIRMED' },
    });
    expect(rsvpDuplicate.statusCode).toBe(200);
    expect(rsvpDuplicate.json().rsvpCount).toBe(1); // Not incremented again!

    // Verify DB count
    const rsvpRecords = await prisma.communityEventRsvp.findMany({
      where: { eventId: testEventId, userId: memberUserId },
    });
    expect(rsvpRecords.length).toBe(1); // Strictly single record!

    // 3. Cancel RSVP
    const cancelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/community/events/${testEventId}/rsvp`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { status: 'CANCELLED' },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().status).toBe('CANCELLED');
    expect(cancelRes.json().rsvpCount).toBe(0);

    // 4. Duplicate Cancel -> Idempotent no-op
    const cancelDuplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/community/events/${testEventId}/rsvp`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { status: 'CANCELLED' },
    });
    expect(cancelDuplicate.statusCode).toBe(200);
    expect(cancelDuplicate.json().rsvpCount).toBe(0);
  });

  // ==============================================================================
  // Hub Following Tests
  // ==============================================================================

  it('supports idempotent hub following and retrieval', async () => {
    // 1. Follow Mumbai hub
    const followRes = await app.inject({
      method: 'POST',
      url: '/api/v1/community/hubs/follow',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { city: 'Mumbai' },
    });
    expect(followRes.statusCode).toBe(200);
    expect(followRes.json().isFollowing).toBe(true);
    expect(followRes.json().totalFollowers).toBeGreaterThanOrEqual(1);

    // 2. Duplicate follow -> Idempotent
    const dupFollowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/community/hubs/follow',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { city: 'Mumbai' },
    });
    expect(dupFollowRes.statusCode).toBe(200);
    expect(dupFollowRes.json().isFollowing).toBe(true);

    // 3. Get followed hubs
    const listFollowedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/community/hubs/following',
      headers: { authorization: `Bearer ${creatorToken}` },
    });
    expect(listFollowedRes.statusCode).toBe(200);
    expect(listFollowedRes.json().cities).toContain('Mumbai');
  });

  // ==============================================================================
  // Moderation Tests
  // ==============================================================================

  it('prohibits non-admin users from moderating community posts (403)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/community/posts/${testPostId}/moderate`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: {
        action: 'HIDE',
        reason: 'Unauthorized attempt to hide post.',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows an ADMIN to hide a reported community post with audit log and outbox event', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/community/posts/${testPostId}/moderate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        action: 'HIDE',
        reason: 'Post contains uncontracted solicitation in discussion thread.',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('HIDDEN');

    // Verify post status in DB
    const post = await prisma.communityPost.findUnique({
      where: { id: testPostId },
    });
    expect(post?.status).toBe('HIDDEN');

    // Verify moderation_actions audit log
    const audit = await prisma.moderationAction.findFirst({
      where: {
        moderatorId: adminUserId,
        targetUserId: creatorUserId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.reason).toContain('Post contains uncontracted solicitation');

    // Verify outbox event
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: testPostId,
        eventType: 'community.post.moderated.v1',
      },
    });
    expect(outbox).not.toBeNull();
    expect(outbox?.status).toBe('PENDING');

    // Verify hidden post is excluded from public feed
    const feedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/community/posts?city=Mumbai',
    });
    expect(feedRes.statusCode).toBe(200);
    const hiddenInFeed = feedRes.json().items.some((p: any) => p.id === testPostId);
    expect(hiddenInFeed).toBe(false);
  });
});
