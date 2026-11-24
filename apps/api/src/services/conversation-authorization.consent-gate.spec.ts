import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getPrismaClient,
  type PrismaClient,
  ConversationAuthorizationService,
  MessagingRepository,
  MessageRequestRequiredError,
  UserBlockedError,
  UserSuspendedError,
  UserNotFoundError,
  SelfMessagingNotAllowedError,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../app.js';
import { defaultJwtVerifier } from './jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../tests/fixtures/auth-test-helper.js';
import type { FastifyInstance } from 'fastify';

describe('Phase 19F Milestone 2B.1 — Consent Gate Security & Policy Enforcement', () => {
  let prisma: PrismaClient;
  let authService: ConversationAuthorizationService;
  let repo: MessagingRepository;
  let app: FastifyInstance;

  // Test users
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let userC: { id: string; email: string };
  let outsider: { id: string; email: string };
  let suspendedUser: { id: string; email: string };
  let deactivatedUser: { id: string; email: string };

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    prisma = getPrismaClient();
    authService = new ConversationAuthorizationService(prisma);
    repo = new MessagingRepository(prisma);
    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    userA = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_gate_a_${ts}`,
        email: `gate_a_${ts}@test.com`,
        firstName: 'Alice',
        lastName: 'Gate',
        status: 'ACTIVE',
      },
    });
    tokenA = await createTestJwt({ sub: userA.supabaseAuthId, email: userA.email });

    userB = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_gate_b_${ts}`,
        email: `gate_b_${ts}@test.com`,
        firstName: 'Bob',
        lastName: 'Gate',
        status: 'ACTIVE',
      },
    });
    tokenB = await createTestJwt({ sub: userB.supabaseAuthId, email: userB.email });

    userC = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_gate_c_${ts}`,
        email: `gate_c_${ts}@test.com`,
        firstName: 'Charlie',
        lastName: 'Gate',
        status: 'ACTIVE',
      },
    });
    tokenC = await createTestJwt({ sub: userC.supabaseAuthId, email: userC.email });

    outsider = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_gate_out_${ts}`,
        email: `gate_out_${ts}@test.com`,
        firstName: 'Eve',
        lastName: 'Outsider',
        status: 'ACTIVE',
      },
    });

    suspendedUser = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_gate_susp_${ts}`,
        email: `gate_susp_${ts}@test.com`,
        firstName: 'Suspended',
        lastName: 'User',
        status: 'SUSPENDED',
      },
    });

    deactivatedUser = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_gate_deact_${ts}`,
        email: `gate_deact_${ts}@test.com`,
        firstName: 'Deactivated',
        lastName: 'User',
        status: 'DEACTIVATED',
      },
    });
  });

  afterAll(async () => {
    // Cleanup in dependency order
    await prisma.messageAttachment.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.messageRequest.deleteMany({});
    await prisma.projectInvitation.deleteMany({});
    await prisma.project.deleteMany({
      where: {
        OR: [
          { clientId: { in: [userA.id, userB.id, userC.id] } },
          { talentId: { in: [userA.id, userB.id, userC.id] } },
        ],
      },
    });
    await prisma.application.deleteMany({
      where: { applicantId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.assignment.deleteMany({
      where: { brand: { userId: { in: [userA.id, userB.id, userC.id] } } },
    });
    await prisma.brandProfile.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.userBlock.deleteMany({
      where: {
        OR: [
          { blockerId: { in: [userA.id, userB.id, userC.id] } },
          { blockedId: { in: [userA.id, userB.id, userC.id] } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [userA.id, userB.id, userC.id, outsider.id, suspendedUser.id, deactivatedUser.id],
        },
      },
    });

    await app.close();
  });

  // ==============================================================================
  // 1. Cold Contact & Lifecycle States
  // ==============================================================================
  describe('1. Cold Contact Rejection & Request Lifecycle', () => {
    it('rejects cold-contact direct conversation without accepted consent or valid exception (403)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);
    });

    it('rejects initiation when request is PENDING', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Pending test',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.messageRequest.delete({ where: { id: req.id } });
    });

    it('rejects initiation when request is DECLINED', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Declined test',
          status: 'DECLINED',
          declinedReason: 'Not interested',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.messageRequest.delete({ where: { id: req.id } });
    });

    it('rejects initiation when request is EXPIRED', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Expired test',
          status: 'EXPIRED',
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.messageRequest.delete({ where: { id: req.id } });
    });

    it('rejects initiation when request is CANCELLED', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Cancelled test',
          status: 'CANCELLED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.messageRequest.delete({ where: { id: req.id } });
    });

    it('authorizes initiation when an ACCEPTED request exists between both users', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Accepted test',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      // Initiator A -> Recipient B
      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).resolves.toBeUndefined();

      // Reverse direction: Recipient B -> Initiator A
      await expect(
        authService.assertCanStartDirectConversation(userB.id, userA.id),
      ).resolves.toBeUndefined();

      await prisma.messageRequest.delete({ where: { id: req.id } });
    });
  });

  // ==============================================================================
  // 2. Participant Isolation
  // ==============================================================================
  describe('2. Participant Isolation', () => {
    it('prevents an unrelated third party from exploiting an accepted request', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Alice to Bob',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      // Outsider Eve cannot initiate with Alice or Bob based on Alice-Bob accepted request
      await expect(
        authService.assertCanStartDirectConversation(outsider.id, userA.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await expect(
        authService.assertCanStartDirectConversation(outsider.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.messageRequest.delete({ where: { id: req.id } });
    });
  });

  // ==============================================================================
  // 3. Commercial Exceptions — Project
  // ==============================================================================
  describe('3. Commercial Exception: Project', () => {
    let assignmentId: string;
    let applicationId: string;
    let brandProfileId: string;

    beforeAll(async () => {
      brandProfileId = generateUuidV7();
      await prisma.brandProfile.create({
        data: {
          id: brandProfileId,
          userId: userA.id,
          companyName: 'Brand Inc',
        },
      });

      assignmentId = generateUuidV7();
      await prisma.assignment.create({
        data: {
          id: assignmentId,
          brandId: brandProfileId,
          title: 'Project Assignment',
          description: 'Description',
          budgetMin: 5000,
          budgetMax: 10000,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      applicationId = generateUuidV7();
      await prisma.application.create({
        data: {
          id: applicationId,
          assignmentId,
          applicantId: userB.id,
          coverLetter: 'I am ready',
          proposedRate: 7500,
          status: 'SUBMITTED',
        },
      });
    });

    afterAll(async () => {
      await prisma.project.deleteMany({ where: { assignmentId } });
      await prisma.application.deleteMany({ where: { id: applicationId } });
      await prisma.assignment.deleteMany({ where: { id: assignmentId } });
      await prisma.brandProfile.deleteMany({ where: { id: brandProfileId } });
    });

    const activeStatuses = [
      'IN_PROGRESS',
      'SUBMITTED',
      'REVISION_REQUESTED',
      'APPROVED',
      'COMPLETED',
      'DISPUTED',
    ] as const;

    for (const status of activeStatuses) {
      it(`authorizes direct conversation when project status is ${status}`, async () => {
        const project = await prisma.project.create({
          data: {
            id: generateUuidV7(),
            assignmentId,
            applicationId,
            clientId: userA.id,
            talentId: userB.id,
            title: `Test Project ${status}`,
            totalAmount: 7500,
            status,
          },
        });

        // Client -> Talent
        await expect(
          authService.assertCanStartDirectConversation(userA.id, userB.id),
        ).resolves.toBeUndefined();

        // Talent -> Client
        await expect(
          authService.assertCanStartDirectConversation(userB.id, userA.id),
        ).resolves.toBeUndefined();

        // Outsider cannot exploit this project
        await expect(
          authService.assertCanStartDirectConversation(outsider.id, userB.id),
        ).rejects.toThrow(MessageRequestRequiredError);

        await prisma.project.delete({ where: { id: project.id } });
      });
    }

    it('rejects direct conversation when project status is CANCELLED (403)', async () => {
      const project = await prisma.project.create({
        data: {
          id: generateUuidV7(),
          assignmentId,
          applicationId,
          clientId: userA.id,
          talentId: userB.id,
          title: 'Cancelled Project',
          totalAmount: 7500,
          status: 'CANCELLED',
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.project.delete({ where: { id: project.id } });
    });
  });

  // ==============================================================================
  // 4. Commercial Exceptions — Application
  // ==============================================================================
  describe('4. Commercial Exception: Application', () => {
    let brandUserId: string;
    let brandProfileId: string;
    let assignmentId: string;

    beforeAll(async () => {
      brandUserId = userA.id;
      brandProfileId = generateUuidV7();
      await prisma.brandProfile.create({
        data: {
          id: brandProfileId,
          userId: brandUserId,
          companyName: 'App Brand Inc',
        },
      });

      assignmentId = generateUuidV7();
      await prisma.assignment.create({
        data: {
          id: assignmentId,
          brandId: brandProfileId,
          title: 'App Assignment',
          description: 'Description',
          budgetMin: 3000,
          budgetMax: 6000,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    });

    afterAll(async () => {
      await prisma.application.deleteMany({ where: { assignmentId } });
      await prisma.assignment.deleteMany({ where: { id: assignmentId } });
      await prisma.brandProfile.deleteMany({ where: { id: brandProfileId } });
    });

    it('authorizes direct conversation when Application is SHORTLISTED', async () => {
      const appRecord = await prisma.application.create({
        data: {
          id: generateUuidV7(),
          assignmentId,
          applicantId: userB.id,
          coverLetter: 'Shortlisted test',
          proposedRate: 4000,
          status: 'SHORTLISTED',
        },
      });

      // Brand -> Applicant
      await expect(
        authService.assertCanStartDirectConversation(brandUserId, userB.id),
      ).resolves.toBeUndefined();

      // Applicant -> Brand
      await expect(
        authService.assertCanStartDirectConversation(userB.id, brandUserId),
      ).resolves.toBeUndefined();

      // Outsider rejected
      await expect(
        authService.assertCanStartDirectConversation(outsider.id, brandUserId),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.application.delete({ where: { id: appRecord.id } });
    });

    it('authorizes direct conversation when Application is ACCEPTED', async () => {
      const appRecord = await prisma.application.create({
        data: {
          id: generateUuidV7(),
          assignmentId,
          applicantId: userB.id,
          coverLetter: 'Accepted test',
          proposedRate: 4000,
          status: 'ACCEPTED',
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(brandUserId, userB.id),
      ).resolves.toBeUndefined();

      await prisma.application.delete({ where: { id: appRecord.id } });
    });

    const nonQualifyingAppStatuses = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'REJECTED',
      'WITHDRAWN',
    ] as const;

    for (const status of nonQualifyingAppStatuses) {
      it(`rejects direct conversation when Application is in state ${status}`, async () => {
        const appRecord = await prisma.application.create({
          data: {
            id: generateUuidV7(),
            assignmentId,
            applicantId: userB.id,
            coverLetter: `Test ${status}`,
            proposedRate: 4000,
            status,
          },
        });

        await expect(
          authService.assertCanStartDirectConversation(brandUserId, userB.id),
        ).rejects.toThrow(MessageRequestRequiredError);

        await prisma.application.delete({ where: { id: appRecord.id } });
      });
    }
  });

  // ==============================================================================
  // 5. Commercial Exceptions — ProjectInvitation
  // ==============================================================================
  describe('5. Commercial Exception: ProjectInvitation', () => {
    let brandProfileId: string;
    let assignmentId: string;
    let applicationId: string;
    let projectId: string;

    beforeAll(async () => {
      brandProfileId = generateUuidV7();
      await prisma.brandProfile.create({
        data: {
          id: brandProfileId,
          userId: userA.id,
          companyName: 'Invitation Brand',
        },
      });

      assignmentId = generateUuidV7();
      await prisma.assignment.create({
        data: {
          id: assignmentId,
          brandId: brandProfileId,
          title: 'Invitation Assignment',
          description: 'Description',
          budgetMin: 5000,
          budgetMax: 10000,
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      applicationId = generateUuidV7();
      await prisma.application.create({
        data: {
          id: applicationId,
          assignmentId,
          applicantId: userB.id,
          coverLetter: 'App',
          proposedRate: 7000,
          status: 'ACCEPTED',
        },
      });

      projectId = generateUuidV7();
      await prisma.project.create({
        data: {
          id: projectId,
          assignmentId,
          applicationId,
          clientId: userA.id,
          talentId: userB.id,
          title: 'Invitation Target Project',
          totalAmount: 7000,
          status: 'IN_PROGRESS',
        },
      });
    });

    afterAll(async () => {
      await prisma.projectInvitation.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
      await prisma.application.deleteMany({ where: { id: applicationId } });
      await prisma.assignment.deleteMany({ where: { id: assignmentId } });
      await prisma.brandProfile.deleteMany({ where: { id: brandProfileId } });
    });

    it('authorizes direct conversation when ProjectInvitation is PENDING and unexpired', async () => {
      // User A invites User C to the project
      const inv = await prisma.projectInvitation.create({
        data: {
          id: generateUuidV7(),
          projectId,
          inviterId: userA.id,
          inviteeId: userC.id,
          status: 'PENDING',
          message: 'Join my project',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Inviter -> Invitee
      await expect(
        authService.assertCanStartDirectConversation(userA.id, userC.id),
      ).resolves.toBeUndefined();

      // Invitee -> Inviter
      await expect(
        authService.assertCanStartDirectConversation(userC.id, userA.id),
      ).resolves.toBeUndefined();

      // Outsider cannot exploit
      await expect(
        authService.assertCanStartDirectConversation(outsider.id, userC.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.projectInvitation.delete({ where: { id: inv.id } });
    });

    it('authorizes direct conversation when ProjectInvitation is ACCEPTED', async () => {
      const inv = await prisma.projectInvitation.create({
        data: {
          id: generateUuidV7(),
          projectId,
          inviterId: userA.id,
          inviteeId: userC.id,
          status: 'ACCEPTED',
          message: 'Join my project',
          respondedAt: new Date(),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userC.id),
      ).resolves.toBeUndefined();

      await prisma.projectInvitation.delete({ where: { id: inv.id } });
    });

    it('rejects direct conversation when ProjectInvitation is EXPIRED', async () => {
      const inv = await prisma.projectInvitation.create({
        data: {
          id: generateUuidV7(),
          projectId,
          inviterId: userA.id,
          inviteeId: userC.id,
          status: 'EXPIRED',
          message: 'Expired invitation',
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userC.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.projectInvitation.delete({ where: { id: inv.id } });
    });

    it('rejects direct conversation when ProjectInvitation has past expiresAt even if status is PENDING', async () => {
      const inv = await prisma.projectInvitation.create({
        data: {
          id: generateUuidV7(),
          projectId,
          inviterId: userA.id,
          inviteeId: userC.id,
          status: 'PENDING',
          message: 'Past expiresAt invitation',
          expiresAt: new Date(Date.now() - 5000),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userC.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.projectInvitation.delete({ where: { id: inv.id } });
    });

    it('rejects direct conversation when ProjectInvitation is DECLINED or WITHDRAWN', async () => {
      const invDeclined = await prisma.projectInvitation.create({
        data: {
          id: generateUuidV7(),
          projectId,
          inviterId: userA.id,
          inviteeId: userC.id,
          status: 'DECLINED',
          message: 'Declined invitation',
          respondedAt: new Date(),
        },
      });

      await expect(
        authService.assertCanStartDirectConversation(userA.id, userC.id),
      ).rejects.toThrow(MessageRequestRequiredError);

      await prisma.projectInvitation.delete({ where: { id: invDeclined.id } });
    });
  });

  // ==============================================================================
  // 6. Blocking & Inactive Account Restrictions Override Consent
  // ==============================================================================
  describe('6. Blocking & Inactive Account Restrictions Override', () => {
    it('blocks conversation initiation even if an ACCEPTED request exists (403 USER_BLOCKED)', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userA.id,
          recipientId: userB.id,
          initialMessage: 'Accepted with block',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      // User A blocks User B
      const block = await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: userA.id,
          blockedId: userB.id,
        },
      });

      // Both directions are blocked
      await expect(
        authService.assertCanStartDirectConversation(userA.id, userB.id),
      ).rejects.toThrow(UserBlockedError);

      await expect(
        authService.assertCanStartDirectConversation(userB.id, userA.id),
      ).rejects.toThrow(UserBlockedError);

      await prisma.userBlock.delete({ where: { id: block.id } });
      await prisma.messageRequest.delete({ where: { id: req.id } });
    });

    it('blocks conversation initiation when recipient is SUSPENDED (403 USER_SUSPENDED)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(userA.id, suspendedUser.id),
      ).rejects.toThrow(UserSuspendedError);
    });

    it('blocks conversation initiation when initiator is SUSPENDED (403 USER_SUSPENDED)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(suspendedUser.id, userA.id),
      ).rejects.toThrow(UserSuspendedError);
    });

    it('blocks conversation initiation when recipient is DEACTIVATED (404 USER_NOT_FOUND)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(userA.id, deactivatedUser.id),
      ).rejects.toThrow(UserNotFoundError);
    });

    it('blocks conversation initiation when initiator is DEACTIVATED (404 USER_NOT_FOUND)', async () => {
      await expect(
        authService.assertCanStartDirectConversation(deactivatedUser.id, userA.id),
      ).rejects.toThrow(UserNotFoundError);
    });
  });

  // ==============================================================================
  // 7. Grandfathering: Existing Conversations Remain Usable
  // ==============================================================================
  describe('7. Grandfathering: Existing Conversations', () => {
    it('authorizes direct conversation if active direct conversation already exists without MessageRequest', async () => {
      // User A and User C have NO message requests and NO commercial projects
      const existingConv = await prisma.conversation.create({
        data: {
          id: generateUuidV7(),
          type: 'DIRECT',
          currentSequence: 0n,
          participants: {
            create: [
              { id: generateUuidV7(), userId: userA.id, role: 'MEMBER' },
              { id: generateUuidV7(), userId: userC.id, role: 'MEMBER' },
            ],
          },
        },
      });

      // Both directions succeed because established conversation exists
      await expect(
        authService.assertCanStartDirectConversation(userA.id, userC.id),
      ).resolves.toBeUndefined();

      await expect(
        authService.assertCanStartDirectConversation(userC.id, userA.id),
      ).resolves.toBeUndefined();

      // Clean up
      await prisma.conversationParticipant.deleteMany({
        where: { conversationId: existingConv.id },
      });
      await prisma.conversation.delete({ where: { id: existingConv.id } });
    });
  });

  // ==============================================================================
  // 8. HTTP Route Enforcement & Consistent Policy
  // ==============================================================================
  describe('8. HTTP Route Policy Consistency (POST /api/v1/conversations)', () => {
    it('rejects POST /api/v1/conversations for cold contact with 403 MESSAGE_REQUEST_REQUIRED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('MESSAGE_REQUEST_REQUIRED');
      expect(body.title).toBe('Message Request Required');
      expect(body.detail).toContain('Direct conversation requires an accepted message request');
    });

    it('succeeds with 201 when accepted MessageRequest exists', async () => {
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userB.id,
          recipientId: userA.id,
          initialMessage: 'Can we chat?',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.type).toBe('DIRECT');

      // Cleanup
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: body.id } });
      await prisma.conversation.delete({ where: { id: body.id } });
      await prisma.messageRequest.delete({ where: { id: req.id } });
    });
  });

  // ==============================================================================
  // 9. Concurrency & Duplicate Conversation Prevention
  // ==============================================================================
  describe('9. Concurrency & Anti-Race Advisory Locking', () => {
    it('concurrent initiation attempts create exactly 1 conversation without duplicates', async () => {
      // Setup accepted request to authorize both users
      const req = await prisma.messageRequest.create({
        data: {
          id: generateUuidV7(),
          senderId: userB.id,
          recipientId: userA.id,
          initialMessage: 'Concurrent test consent',
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          respondedAt: new Date(),
        },
      });

      // Launch 10 simultaneous calls from both directions
      const promises = [
        repo.createOrGetDirectConversation(userA.id, userB.id),
        repo.createOrGetDirectConversation(userB.id, userA.id),
        repo.createOrGetDirectConversation(userA.id, userB.id),
        repo.createOrGetDirectConversation(userB.id, userA.id),
        repo.createOrGetDirectConversation(userA.id, userB.id),
        repo.createOrGetDirectConversation(userB.id, userA.id),
        repo.createOrGetDirectConversation(userA.id, userB.id),
        repo.createOrGetDirectConversation(userB.id, userA.id),
        repo.createOrGetDirectConversation(userA.id, userB.id),
        repo.createOrGetDirectConversation(userB.id, userA.id),
      ];

      const results = await Promise.all(promises);

      // All returned conversation IDs must be identical
      const firstId = results[0]!.id;
      for (const res of results) {
        expect(res.id).toBe(firstId);
      }

      // Check PostgreSQL directly: exactly 1 conversation exists between User A and User B
      const totalConversations = await prisma.conversation.count({
        where: {
          type: 'DIRECT',
          deletedAt: null,
          AND: [
            { participants: { some: { userId: userA.id, leftAt: null } } },
            { participants: { some: { userId: userB.id, leftAt: null } } },
          ],
        },
      });
      expect(totalConversations).toBe(1);

      // Check participants: exactly 2 participants exist for this conversation
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId: firstId },
      });
      expect(participants).toHaveLength(2);

      // Cleanup
      await prisma.conversationParticipant.deleteMany({ where: { conversationId: firstId } });
      await prisma.conversation.delete({ where: { id: firstId } });
      await prisma.messageRequest.delete({ where: { id: req.id } });
    });
  });
});
