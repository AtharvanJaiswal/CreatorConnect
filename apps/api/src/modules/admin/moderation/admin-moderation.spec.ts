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
  ReportCategory,
  ReportStatus,
  ReviewStatus,
  ProjectStatus,
  SupportTicketStatus,
  SupportTicketCategory,
  SupportTicketPriority,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Admin Trust, Safety & Support Administration (Milestone 5)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let trustSafetyAdminUser: { id: string; email: string; sub: string };
  let trustSafetyAdminToken: string;

  let regularUser: { id: string; email: string; sub: string };
  let regularToken: string;

  let reporterUser: { id: string; email: string; sub: string };
  let reportedUser: { id: string; email: string; sub: string };

  let testReportId: string;
  let testDismissReportId: string;
  let testReviewId: string;
  let testSupportTicketId: string;

  const createdUserIds: string[] = [];
  const createdReportIds: string[] = [];
  const createdReviewIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdSupportTicketIds: string[] = [];

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
    const trustSafetyAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'TRUST_SAFETY_ADMIN' },
    });

    const ts = Date.now();

    // 1. Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `mod_sa_${ts}@test.com`,
      sub: `sub_mod_sa_${ts}`,
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

    // 2. Trust & Safety Admin
    trustSafetyAdminUser = {
      id: generateUuidV7(),
      email: `mod_ts_${ts}@test.com`,
      sub: `sub_mod_ts_${ts}`,
    };
    createdUserIds.push(trustSafetyAdminUser.id);

    await prisma.user.create({
      data: {
        id: trustSafetyAdminUser.id,
        supabaseAuthId: trustSafetyAdminUser.sub,
        email: trustSafetyAdminUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: trustSafetyAdminUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: {
        id: generateUuidV7(),
        userId: trustSafetyAdminUser.id,
        roleId: trustSafetyAdminRole.id,
      },
    });
    trustSafetyAdminToken = await createTestJwt({
      sub: trustSafetyAdminUser.sub,
      email: trustSafetyAdminUser.email,
    });

    // 3. Regular User (Reporter)
    reporterUser = {
      id: generateUuidV7(),
      email: `reporter_${ts}@test.com`,
      sub: `sub_reporter_${ts}`,
    };
    createdUserIds.push(reporterUser.id);

    await prisma.user.create({
      data: {
        id: reporterUser.id,
        supabaseAuthId: reporterUser.sub,
        email: reporterUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: reporterUser.id, roleId: creatorGlobalRole.id },
    });
    regularToken = await createTestJwt({ sub: reporterUser.sub, email: reporterUser.email });

    // 4. Reported User (Target)
    reportedUser = {
      id: generateUuidV7(),
      email: `reported_${ts}@test.com`,
      sub: `sub_reported_${ts}`,
    };
    createdUserIds.push(reportedUser.id);

    await prisma.user.create({
      data: {
        id: reportedUser.id,
        supabaseAuthId: reportedUser.sub,
        email: reportedUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: reportedUser.id, roleId: creatorGlobalRole.id },
    });

    // 5. Test Reports
    testReportId = generateUuidV7();
    createdReportIds.push(testReportId);
    await prisma.report.create({
      data: {
        id: testReportId,
        reporterId: reporterUser.id,
        targetType: 'USER',
        targetId: reportedUser.id,
        category: ReportCategory.HARASSMENT,
        details: 'User sent abusive messages in project chat',
        status: ReportStatus.PENDING,
      },
    });

    testDismissReportId = generateUuidV7();
    createdReportIds.push(testDismissReportId);
    await prisma.report.create({
      data: {
        id: testDismissReportId,
        reporterId: reporterUser.id,
        targetType: 'USER',
        targetId: reportedUser.id,
        category: ReportCategory.SPAM,
        details: 'User posted duplicate portfolio link',
        status: ReportStatus.PENDING,
      },
    });

    // 6. Test Project & Review
    const clProfileId = generateUuidV7();
    await prisma.brandProfile.create({
      data: {
        id: clProfileId,
        userId: reporterUser.id,
        companyName: 'Reviewer Brand Co',
      },
    });

    const asId = generateUuidV7();
    const appId = generateUuidV7();
    const pId = generateUuidV7();
    createdAssignmentIds.push(asId);
    createdApplicationIds.push(appId);
    createdProjectIds.push(pId);

    await prisma.assignment.create({
      data: {
        id: asId,
        brandId: clProfileId,
        title: 'Social Video Project',
        description: 'Test project description',
        budgetMin: 500000,
        budgetMax: 500000,
        currency: 'INR',
        deadline: new Date(Date.now() + 86400000 * 30),
      },
    });

    await prisma.application.create({
      data: {
        id: appId,
        assignmentId: asId,
        applicantId: reportedUser.id,
        coverLetter: 'Application cover letter',
        proposedRate: 500000,
        currency: 'INR',
      },
    });

    await prisma.project.create({
      data: {
        id: pId,
        assignmentId: asId,
        applicationId: appId,
        clientId: reporterUser.id,
        talentId: reportedUser.id,
        title: 'Social Video Project',
        totalAmount: 500000,
        currency: 'INR',
        status: ProjectStatus.COMPLETED,
      },
    });

    testReviewId = generateUuidV7();
    createdReviewIds.push(testReviewId);
    await prisma.review.create({
      data: {
        id: testReviewId,
        projectId: pId,
        reviewerId: reporterUser.id,
        revieweeId: reportedUser.id,
        rating: 1,
        feedback: 'Inappropriate language and missed all deliverables.',
        status: ReviewStatus.PUBLISHED,
      },
    });

    // 7. Test Support Ticket
    testSupportTicketId = generateUuidV7();
    createdSupportTicketIds.push(testSupportTicketId);
    await prisma.supportTicket.create({
      data: {
        id: testSupportTicketId,
        ticketNumber: `TICK-${ts}`,
        requesterId: reporterUser.id,
        category: SupportTicketCategory.OTHER,
        priority: SupportTicketPriority.HIGH,
        status: SupportTicketStatus.OPEN,
        subject: 'Cannot upload deliverables for review',
        description: 'Encountered 500 error when uploading MP4 video file.',
      },
    });
  });

  afterAll(async () => {
    for (const tid of createdSupportTicketIds) {
      await prisma.supportTicketMessage.deleteMany({ where: { ticketId: tid } });
      await prisma.supportTicketAudit.deleteMany({ where: { ticketId: tid } });
      await prisma.supportTicket.deleteMany({ where: { id: tid } });
    }
    for (const rid of createdReviewIds) {
      await prisma.reviewModerationAudit.deleteMany({ where: { reviewId: rid } });
      await prisma.reviewReport.deleteMany({ where: { reviewId: rid } });
      await prisma.review.deleteMany({ where: { id: rid } });
    }
    for (const pid of createdProjectIds) {
      await prisma.project.deleteMany({ where: { id: pid } });
    }
    for (const appId of createdApplicationIds) {
      await prisma.application.deleteMany({ where: { id: appId } });
    }
    for (const asId of createdAssignmentIds) {
      await prisma.assignment.deleteMany({ where: { id: asId } });
    }
    for (const repId of createdReportIds) {
      await prisma.moderationAction.deleteMany({ where: { targetUserId: reportedUser.id } });
      await prisma.report.deleteMany({ where: { id: repId } });
    }
    for (const uid of createdUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId: uid } });
      await prisma.brandProfile.deleteMany({ where: { userId: uid } });
      await prisma.adminUserRole.deleteMany({ where: { userId: uid } });
      await prisma.userRole.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    await app.close();
  });

  // ==============================================================================
  // Reports & Moderation Queue Tests
  // ==============================================================================

  it('GET /api/v1/admin/reports - should deny unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/reports - should deny unauthorized regular users with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports',
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/v1/admin/reports - should list reports for Trust & Safety admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reports?status=PENDING',
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const found = body.items.find((r: any) => r.id === testReportId);
    expect(found).toBeDefined();
    expect(found.category).toBe(ReportCategory.HARASSMENT);
    expect(found.targetId).toBe(reportedUser.id);
  });

  it('GET /api/v1/admin/reports/:id - should return single report with target preview', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/reports/${testReportId}`,
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(testReportId);
    expect(body.targetDetails).toBeDefined();
    expect(body.targetDetails.email).toBe(reportedUser.email);
  });

  it('POST /api/v1/admin/reports/:id/resolve - should resolve report, create ModerationAction, and suspend user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reports/${testReportId}/resolve`,
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
      payload: {
        action: 'SUSPEND',
        notes: 'Confirmed severe harassment violation across messaging threads.',
        targetUserId: reportedUser.id,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('RESOLVED');

    // Verify User suspended in DB
    const uInDb = await prisma.user.findUnique({ where: { id: reportedUser.id } });
    expect(uInDb?.status).toBe(UserStatus.SUSPENDED);

    // Verify ModerationAction recorded
    const modAction = await prisma.moderationAction.findFirst({
      where: { targetUserId: reportedUser.id, actionType: 'SUSPEND' },
    });
    expect(modAction).toBeDefined();
    expect(modAction?.moderatorId).toBe(trustSafetyAdminUser.id);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: testReportId, action: 'REPORT_RESOLVED' },
    });
    expect(audit).toBeDefined();
    expect(audit?.userId).toBe(trustSafetyAdminUser.id);
  });

  it('POST /api/v1/admin/reports/:id/dismiss - should dismiss report with audit log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reports/${testDismissReportId}/dismiss`,
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
      payload: {
        reason:
          'Reported portfolio links are legitimate and compliant with marketplace guidelines.',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('DISMISSED');

    const repInDb = await prisma.report.findUnique({ where: { id: testDismissReportId } });
    expect(repInDb?.status).toBe('DISMISSED');

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: testDismissReportId, action: 'REPORT_DISMISSED' },
    });
    expect(audit).toBeDefined();
  });

  // ==============================================================================
  // Review Moderation Tests
  // ==============================================================================

  it('GET /api/v1/admin/reviews - should list reviews with filters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/reviews?status=PUBLISHED&revieweeId=${reportedUser.id}`,
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const found = body.items.find((r: any) => r.id === testReviewId);
    expect(found).toBeDefined();
    expect(found.rating).toBe(1);
  });

  it('POST /api/v1/admin/reviews/:id/moderate - should hide review and write moderation audit', async () => {
    // 1. Hide review
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reviews/${testReviewId}/moderate`,
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
      payload: {
        action: 'HIDE',
        reason: 'Contains unverified allegations subject to active investigation.',
        internalNotes: 'Temporarily hidden pending resolution of dispute.',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().status).toBe('HIDDEN');

    // Verify Review in DB
    const revInDb = await prisma.review.findUnique({ where: { id: testReviewId } });
    expect(revInDb?.status).toBe(ReviewStatus.HIDDEN);

    // Verify ReviewModerationAudit
    const auditRecord = await prisma.reviewModerationAudit.findFirst({
      where: { reviewId: testReviewId, toStatus: ReviewStatus.HIDDEN },
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.moderatorId).toBe(trustSafetyAdminUser.id);

    // 2. Restore review
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/reviews/${testReviewId}/moderate`,
      headers: { authorization: `Bearer ${trustSafetyAdminToken}` },
      payload: {
        action: 'RESTORE',
        reason: 'Investigation concluded. Review verified as truthful feedback.',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().status).toBe('PUBLISHED');
  });

  // ==============================================================================
  // Admin Support Ticket & Internal Note Isolation Tests
  // ==============================================================================

  it('GET /api/v1/admin/support/tickets - should list tickets for staff', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/support/tickets',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const found = body.items.find((t: any) => t.id === testSupportTicketId);
    expect(found).toBeDefined();
    expect(found.subject).toBe('Cannot upload deliverables for review');
  });

  it('POST /api/v1/admin/support/tickets/:id/notes - should add internal staff note and ENFORCE ISOLATION from customers', async () => {
    // 1. Admin adds internal note
    const noteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/support/tickets/${testSupportTicketId}/notes`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        body: 'CONFIDENTIAL: Engineering identified that Cloudflare R2 presigned URL generator was failing on high-bitrate video assets. Fix deploying in 1 hour.',
      },
    });
    expect(noteRes.statusCode).toBe(201);
    expect(noteRes.json().isInternal).toBe(true);

    // 2. Admin adds public staff reply
    const replyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/support/tickets/${testSupportTicketId}/reply`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        body: 'Hello! Our team has identified the upload issue and a fix is currently in progress. We will notify you shortly.',
      },
    });
    expect(replyRes.statusCode).toBe(201);
    expect(replyRes.json().isInternal).toBe(false);

    // 3. Admin fetches messages via admin endpoint -> SEES BOTH public reply and internal note
    const adminFetchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/support/tickets/${testSupportTicketId}/messages`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(adminFetchRes.statusCode).toBe(200);
    const adminMessages = adminFetchRes.json().items;
    const internalNote = adminMessages.find((m: any) => m.isInternal === true);
    expect(internalNote).toBeDefined();
    expect(internalNote.body).toContain('CONFIDENTIAL');

    // 4. CUSTOMER fetches messages via customer endpoint -> STRICT INTERNAL NOTE ISOLATION: NEVER SEES INTERNAL NOTE
    const customerFetchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testSupportTicketId}/messages`,
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(customerFetchRes.statusCode).toBe(200);
    const customerMessages = customerFetchRes.json().items;
    const leakedNote = customerMessages.find((m: any) => m.isInternal === true);
    expect(leakedNote).toBeUndefined(); // MUST NEVER LEAK!
    const publicReply = customerMessages.find((m: any) => m.isInternal === false);
    expect(publicReply).toBeDefined();
    expect(publicReply.body).toContain('Our team has identified');
  });
});
