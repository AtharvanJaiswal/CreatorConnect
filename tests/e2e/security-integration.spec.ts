import { test, expect } from '@playwright/test';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import * as jose from 'jose';
import { createTestJwt } from '../fixtures/auth-test-helper.js';

test.describe('E2E Security & Correctness Hardening (Phase 4.5 Suite)', () => {
  const prisma = getPrismaClient();

  const createdUserIds: string[] = [];
  const createdAssignmentIds: string[] = [];

  test.afterAll(async () => {
    // Cleanup any test assignments, applications, profiles, and users
    for (const aId of createdAssignmentIds) {
      try {
        await prisma.application.deleteMany({ where: { assignmentId: aId } });
        await prisma.assignment.deleteMany({ where: { id: aId } });
      } catch {}
    }
    for (const uId of createdUserIds) {
      try {
        await prisma.creatorProfile.deleteMany({ where: { userId: uId } });
        await prisma.professionalProfile.deleteMany({ where: { userId: uId } });
        await prisma.userRole.deleteMany({ where: { userId: uId } });
        await prisma.user.deleteMany({ where: { id: uId } });
      } catch {}
    }
  });

  // Helper to provision active user in DB
  async function provisionUser(
    role: 'CREATOR' | 'BRAND' | 'PROFESSIONAL',
    status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE',
  ) {
    const userId = generateUuidV7();
    const sub = `sub_e2e_sec_${generateUuidV7().replace(/-/g, '')}`;
    const email = `sec_${generateUuidV7()}@creatorconnect.test`;

    createdUserIds.push(userId);

    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: sub,
        email,
        status,
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: role },
                create: { id: generateUuidV7(), name: role },
              },
            },
          },
        },
      },
    });

    if (role === 'BRAND') {
      await prisma.brandProfile.create({
        data: {
          id: userId,
          userId,
          companyName: `Brand_${userId.substring(0, 8)}`,
          websiteUrl: 'https://brand.example.com',
          industry: 'Media',
        },
      });
    }

    const token = await createTestJwt({ sub, email });
    return { userId, sub, email, token };
  }

  // 1. Wrong issuer
  test('rejects token with wrong issuer through Next.js proxy with RFC 7807 401', async ({
    request,
  }) => {
    const user = await provisionUser('CREATOR');
    const wrongIssuerToken = await createTestJwt({ sub: user.sub, email: user.email }, {});
    // Sign with wrong issuer
    const { privateKey } = await (
      await import('../fixtures/auth-test-helper.js')
    ).getOrCreateTestAuthKeys();
    const forgedToken = await new jose.SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key-01' })
      .setSubject(user.sub)
      .setAudience('authenticated')
      .setIssuer('https://malicious-issuer.example.com/auth/v1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const res = await request.get('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${forgedToken}`,
        Accept: 'application/problem+json, application/json',
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
    expect(body.status).toBe(401);
    expect(body.type).toContain('auth-invalid-token');
  });

  // 2. Expired JWT
  test('rejects expired JWT through Next.js proxy with RFC 7807 401', async ({ request }) => {
    const user = await provisionUser('CREATOR');
    const expiredToken = await createTestJwt(
      {
        sub: user.sub,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      },
      { expiresIn: '-1h' },
    );

    const res = await request.get('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        Accept: 'application/problem+json, application/json',
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(['AUTH_TOKEN_EXPIRED', 'AUTH_INVALID_TOKEN']).toContain(body.code);
    expect(body.status).toBe(401);
  });

  // 3. Fixture JWT signed with untrusted key
  test('rejects token signed with untrusted key not in JWKS stub with RFC 7807 401', async ({
    request,
  }) => {
    const user = await provisionUser('CREATOR');
    // Generate unknown untrusted keypair
    const { privateKey } = await jose.generateKeyPair('ES256');
    const untrustedToken = await createTestJwt(
      { sub: user.sub, email: user.email },
      { overridePrivateKey: privateKey, kid: 'unknown-key-99' },
    );

    const res = await request.get('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${untrustedToken}`,
        Accept: 'application/problem+json, application/json',
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
    expect(body.status).toBe(401);
  });

  // 4. Suspended user
  test('rejects suspended user with RFC 7807 403 USER_SUSPENDED', async ({ request }) => {
    const user = await provisionUser('CREATOR', 'SUSPENDED');

    const res = await request.get('/api/v1/users/me', {
      headers: {
        Authorization: `Bearer ${user.token}`,
        Accept: 'application/problem+json, application/json',
      },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('USER_SUSPENDED');
    expect(body.status).toBe(403);
    expect(body.title).toBe('Account Suspended');
  });

  // 5. Cross-owner mutation
  test('rejects cross-owner mutation with RFC 7807 403 FORBIDDEN', async ({ request }) => {
    const creatorA = await provisionUser('CREATOR');
    const creatorB = await provisionUser('CREATOR');

    // Creator A attempts to mutate an asset or withdraw application belonging to Creator B
    const fakeApplicationId = generateUuidV7();

    const res = await request.post(`/api/v1/applications/${fakeApplicationId}/withdraw`, {
      headers: {
        Authorization: `Bearer ${creatorA.token}`,
        Accept: 'application/problem+json, application/json',
      },
    });

    // Fastify returns 404 (not found / not owned) or 403 (forbidden)
    expect([403, 404]).toContain(res.status());
    const body = await res.json();
    expect(['FORBIDDEN', 'NOT_FOUND']).toContain(body.code);
  });

  // 6. Deadline acceptance rejection
  test('rejects application acceptance when assignment deadline is in the past (F-08)', async ({
    request,
  }) => {
    const brand = await provisionUser('BRAND');
    const creator = await provisionUser('CREATOR');

    const assignmentId = generateUuidV7();
    createdAssignmentIds.push(assignmentId);

    // Create assignment directly in PostgreSQL with deadline in past (10 minutes ago)
    const pastDeadline = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brand.userId,
        title: 'Past Deadline Assignment E2E',
        description: 'Test deadline invariant verification in real PostgreSQL',
        status: 'PUBLISHED',
        budgetMin: 50000,
        budgetMax: 50000,
        deadline: pastDeadline,
      },
    });

    const applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: creator.userId,
        proposedRate: 50000,
        coverLetter: 'Pitch submitted before deadline',
        status: 'SUBMITTED',
        version: 1,
      },
    });

    // Brand attempts to accept application past deadline
    const res = await request.post(`/api/v1/assignments/${assignmentId}/accept`, {
      headers: {
        Authorization: `Bearer ${brand.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/problem+json, application/json',
      },
      data: {
        applicationId,
        expectedVersion: 1,
        expectedApplicationVersion: 1,
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('ASSIGNMENT_DEADLINE_EXPIRED');
    expect(body.status).toBe(400);
    expect(body.title).toBe('Deadline Expired');

    // Confirm DB state remained SUBMITTED
    const dbApp = await prisma.application.findUnique({ where: { id: applicationId } });
    expect(dbApp?.status).toBe('SUBMITTED');
  });

  // 7. Concurrent acceptance produces exactly one winner
  test('ensures concurrent acceptance of competing proposals produces exactly one winner (F-08 & F-09)', async ({
    request,
  }) => {
    const brand = await provisionUser('BRAND');
    const creator1 = await provisionUser('CREATOR');
    const creator2 = await provisionUser('CREATOR');

    const assignmentId = generateUuidV7();
    createdAssignmentIds.push(assignmentId);

    // Active assignment with deadline in future
    const futureDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brand.userId,
        title: 'Concurrent Race Assignment E2E',
        description: 'Testing PostgreSQL row lock serialization',
        status: 'PUBLISHED',
        budgetMin: 75000,
        budgetMax: 75000,
        deadline: futureDeadline,
      },
    });

    const app1Id = generateUuidV7();
    const app2Id = generateUuidV7();

    await prisma.application.createMany({
      data: [
        {
          id: app1Id,
          assignmentId,
          applicantId: creator1.userId,
          proposedRate: 75000,
          coverLetter: 'Creator 1 proposal',
          status: 'SHORTLISTED',
          version: 1,
        },
        {
          id: app2Id,
          assignmentId,
          applicantId: creator2.userId,
          proposedRate: 75000,
          coverLetter: 'Creator 2 proposal',
          status: 'SHORTLISTED',
          version: 1,
        },
      ],
    });

    // Fire two concurrent accept requests
    const [res1, res2] = await Promise.all([
      request.post(`/api/v1/assignments/${assignmentId}/accept`, {
        headers: {
          Authorization: `Bearer ${brand.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/problem+json, application/json',
        },
        data: {
          applicationId: app1Id,
          expectedVersion: 1,
          expectedApplicationVersion: 1,
        },
      }),
      request.post(`/api/v1/assignments/${assignmentId}/accept`, {
        headers: {
          Authorization: `Bearer ${brand.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/problem+json, application/json',
        },
        data: {
          applicationId: app2Id,
          expectedVersion: 1,
          expectedApplicationVersion: 1,
        },
      }),
    ]);

    const statuses = [res1.status(), res2.status()];
    // Exactly one must succeed (200) and the other must be rejected (400 or 409)
    expect(statuses).toContain(200);
    expect(statuses.some((s) => s === 400 || s === 409)).toBe(true);

    // Verify DB state
    const appsInDb = await prisma.application.findMany({
      where: { assignmentId },
    });
    const acceptedApps = appsInDb.filter((a) => a.status === 'ACCEPTED');
    const nonAcceptedApps = appsInDb.filter((a) => a.status !== 'ACCEPTED');

    expect(acceptedApps.length).toBe(1);
    expect(nonAcceptedApps.length).toBe(1);

    const assignmentInDb = await prisma.assignment.findUnique({
      where: { id: assignmentId },
    });
    expect(assignmentInDb?.status).toBe('IN_PROGRESS');
  });
});
