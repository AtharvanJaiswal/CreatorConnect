import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';
import { defaultJwtVerifier } from '../../../services/jwt-verifier.js';
import {
  createTestJwt,
  createTestKeySet,
} from '../../../../../../tests/fixtures/auth-test-helper.js';
import {
  getPrismaClient,
  UserStatus,
  RoleType,
  ProjectStatus,
  DeliverableStatus,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Admin Marketplace Administration (Milestone 3)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let regularUser: { id: string; email: string; sub: string };
  let regularToken: string;

  let creatorUser: { id: string; email: string; sub: string; profileId: string };
  let clientUser: { id: string; email: string; sub: string; profileId: string };
  let testProject: { id: string; assignmentId: string; applicationId: string };

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdApplicationIds: string[] = [];

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const adminGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.ADMIN },
    });
    const creatorGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.CREATOR },
    });
    const clientGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.BRAND },
    });
    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });

    const ts = Date.now();

    // 1. Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `mkt_sa_${ts}@test.com`,
      sub: `sub_mkt_sa_${ts}`,
    };
    createdUserIds.push(superAdminUser.id);

    await prisma.user.create({
      data: {
        id: superAdminUser.id,
        supabaseAuthId: superAdminUser.sub,
        email: superAdminUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: superAdminRole.id },
    });
    superAdminToken = await createTestJwt({ sub: superAdminUser.sub, email: superAdminUser.email });

    // 2. Regular user (no admin permissions)
    regularUser = {
      id: generateUuidV7(),
      email: `mkt_reg_${ts}@test.com`,
      sub: `sub_mkt_reg_${ts}`,
    };
    createdUserIds.push(regularUser.id);

    await prisma.user.create({
      data: {
        id: regularUser.id,
        supabaseAuthId: regularUser.sub,
        email: regularUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: regularUser.id, roleId: creatorGlobalRole.id },
    });
    regularToken = await createTestJwt({ sub: regularUser.sub, email: regularUser.email });

    // 3. Creator with CreatorProfile
    const cUserId = generateUuidV7();
    const cProfileId = generateUuidV7();
    creatorUser = {
      id: cUserId,
      email: `creator_${ts}@test.com`,
      sub: `sub_creator_${ts}`,
      profileId: cProfileId,
    };
    createdUserIds.push(cUserId);

    await prisma.user.create({
      data: {
        id: cUserId,
        supabaseAuthId: creatorUser.sub,
        email: creatorUser.email,
        firstName: 'Jane',
        lastName: 'Creator',
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: cUserId, roleId: creatorGlobalRole.id },
    });
    await prisma.creatorProfile.create({
      data: {
        id: cProfileId,
        userId: cUserId,
        bio: 'Award-winning video creator and storyteller',
        isVerified: false,
      },
    });

    // 4. Client with BrandProfile
    const clUserId = generateUuidV7();
    const clProfileId = generateUuidV7();
    clientUser = {
      id: clUserId,
      email: `client_${ts}@test.com`,
      sub: `sub_client_${ts}`,
      profileId: clProfileId,
    };
    createdUserIds.push(clUserId);

    await prisma.user.create({
      data: {
        id: clUserId,
        supabaseAuthId: clientUser.sub,
        email: clientUser.email,
        firstName: 'Apex',
        lastName: 'Brand',
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: clUserId, roleId: clientGlobalRole.id },
    });
    await prisma.brandProfile.create({
      data: {
        id: clProfileId,
        userId: clUserId,
        companyName: 'Apex Brands Corp',
        industry: 'Apparel',
        isVerified: false,
      },
    });

    // 5. Test Project
    const assignmentId = generateUuidV7();
    const applicationId = generateUuidV7();
    const projectId = generateUuidV7();
    createdAssignmentIds.push(assignmentId);
    createdApplicationIds.push(applicationId);
    createdProjectIds.push(projectId);

    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: clProfileId,
        title: 'Spring Campaign Video',
        description: 'Deliver high energy short-form videos',
        budgetMin: 5000000,
        budgetMax: 5000000,
        currency: 'INR',
        deadline: new Date(Date.now() + 86400000 * 30),
      },
    });

    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: cUserId,
        coverLetter: 'I have 5 years experience creating videos for apparel brands',
        proposedRate: 5000000,
        currency: 'INR',
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        assignmentId,
        applicationId,
        clientId: clUserId,
        talentId: cUserId,
        title: 'Spring Campaign Video Project',
        description: 'Produce and deliver final video files',
        totalAmount: 5000000,
        currency: 'INR',
        status: ProjectStatus.IN_PROGRESS,
      },
    });

    // Add a deliverable
    const deliverableId = generateUuidV7();
    await prisma.projectDeliverable.create({
      data: {
        id: deliverableId,
        projectId,
        title: 'Rough Cut Delivery',
        amount: 2500000,
        status: DeliverableStatus.PENDING,
      },
    });

    testProject = { id: projectId, assignmentId, applicationId };
  });

  afterAll(async () => {
    // Clean up
    for (const pid of createdProjectIds) {
      await prisma.disputeStatusHistory.deleteMany({ where: { dispute: { projectId: pid } } });
      await prisma.disputeEvidence.deleteMany({ where: { dispute: { projectId: pid } } });
      await prisma.dispute.deleteMany({ where: { projectId: pid } });
      await prisma.projectDeliverableSubmission.deleteMany({
        where: { deliverable: { projectId: pid } },
      });
      await prisma.projectDeliverable.deleteMany({ where: { projectId: pid } });
      await prisma.projectCancellation.deleteMany({ where: { projectId: pid } });
      await prisma.project.deleteMany({ where: { id: pid } });
    }
    for (const appId of createdApplicationIds) {
      await prisma.application.deleteMany({ where: { id: appId } });
    }
    for (const asId of createdAssignmentIds) {
      await prisma.assignment.deleteMany({ where: { id: asId } });
    }
    for (const uid of createdUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId: uid } });
      await prisma.auditLog.deleteMany({ where: { entityId: uid } });
      await prisma.creatorProfile.deleteMany({ where: { userId: uid } });
      await prisma.brandProfile.deleteMany({ where: { userId: uid } });
      await prisma.adminUserRole.deleteMany({ where: { userId: uid } });
      await prisma.userRole.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    await app.close();
  });

  // ==============================================================================
  // Creator Management Tests
  // ==============================================================================

  it('GET /api/v1/admin/creators - should deny unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/creators',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/creators - should deny regular user without permissions with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/creators',
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/v1/admin/creators - should list creators for authorized admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/creators?search=Creator',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    const found = body.items.find((c: any) => c.userId === creatorUser.id);
    expect(found).toBeDefined();
    expect(found.isVerified).toBe(false);
  });

  it('POST /api/v1/admin/creators/:id/verify - should toggle verified status and log audit', async () => {
    // 1. Verify creator
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/creators/${creatorUser.profileId}/verify`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isVerified: true,
        reason: 'Identity and high quality portfolio verified by operations team',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().isVerified).toBe(true);

    // Verify DB
    const profileInDb = await prisma.creatorProfile.findUnique({
      where: { id: creatorUser.profileId },
    });
    expect(profileInDb?.isVerified).toBe(true);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: creatorUser.profileId,
        action: 'CREATOR_VERIFIED',
      },
    });
    expect(audit).toBeDefined();
    expect(audit?.userId).toBe(superAdminUser.id);

    // 2. Unverify creator
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/creators/${creatorUser.profileId}/verify`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isVerified: false,
        reason: 'Routine quarterly badge review',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().isVerified).toBe(false);
  });

  // ==============================================================================
  // Client Management Tests
  // ==============================================================================

  it('GET /api/v1/admin/clients - should list clients with metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/clients?search=Apex',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const found = body.items.find((c: any) => c.userId === clientUser.id);
    expect(found).toBeDefined();
    expect(found.companyName).toBe('Apex Brands Corp');
    expect(found.isVerified).toBe(false);
  });

  it('POST /api/v1/admin/clients/:id/verify - should toggle verified badge for client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clients/${clientUser.profileId}/verify`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isVerified: true,
        reason: 'Corporate registration and GSTIN validated',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().isVerified).toBe(true);

    const profileInDb = await prisma.brandProfile.findUnique({
      where: { id: clientUser.profileId },
    });
    expect(profileInDb?.isVerified).toBe(true);
  });

  // ==============================================================================
  // Project Governance Tests
  // ==============================================================================

  it('GET /api/v1/admin/projects - should list projects with status and participant filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects?status=IN_PROGRESS&clientId=${clientUser.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const found = body.items.find((p: any) => p.id === testProject.id);
    expect(found).toBeDefined();
    expect(found.title).toBe('Spring Campaign Video Project');
    expect(found.totalAmountMinor).toBe('5000000');
  });

  it('GET /api/v1/admin/projects/:id - should return complete project details with relations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/projects/${testProject.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(testProject.id);
    expect(body.client.id).toBe(clientUser.id);
    expect(body.talent.id).toBe(creatorUser.id);
    expect(body.deliverables.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/admin/projects/:id/moderate - should enforce moderation actions with audit log', async () => {
    // 1. Flag under review
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${testProject.id}/moderate`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        action: 'FLAG_UNDER_REVIEW',
        reason: 'Flagged for compliance review regarding licensing terms',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().status).toBe(ProjectStatus.DISPUTED);

    // Verify DB
    let pDb = await prisma.project.findUnique({ where: { id: testProject.id } });
    expect(pDb?.status).toBe(ProjectStatus.DISPUTED);

    // Verify AuditLog
    const audit1 = await prisma.auditLog.findFirst({
      where: {
        entityId: testProject.id,
        action: 'PROJECT_MODERATED',
      },
    });
    expect(audit1).toBeDefined();

    // 2. Restore project
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/projects/${testProject.id}/moderate`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        action: 'RESTORE',
        reason: 'Licensing terms confirmed compliant with marketplace rules',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().status).toBe(ProjectStatus.IN_PROGRESS);

    pDb = await prisma.project.findUnique({ where: { id: testProject.id } });
    expect(pDb?.status).toBe(ProjectStatus.IN_PROGRESS);
  });
});
