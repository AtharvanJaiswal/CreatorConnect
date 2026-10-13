import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { ledgerService } from '../payments/ledger/ledger.service.js';

describe('Phase 6 Increment 3: Dispute Resolution, Cancellations, Refunds & Financial Recovery', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let talentUserId: string;
  let talentToken: string;

  let adminUserId: string;
  let adminToken: string;

  let adminAsClientUserId: string;
  let adminAsClientToken: string;

  let bystanderUserId: string;
  let bystanderToken: string;

  let activeMediaAssetId: string;
  let quarantinedMediaAssetId: string;

  let projectId: string;
  let deliverableId: string;
  let assignmentId: string;
  let applicationId: string;

  let capturedPaymentIntentId: string;
  const paymentAmount = 100000; // 1,000 INR (100,000 paisa)
  const testWebhookSecret = 'mock_webhook_secret_dev_key';

  async function createIndependentProject(params: {
    clientId: string;
    talentId: string;
    amount: number;
    title?: string;
    status?: any;
  }) {
    const assignId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignId,
        brandId: clientBrandProfileId,
        title: params.title || 'Independent Project Assignment',
        description: 'Brief description',
        budgetMin: params.amount,
        budgetMax: params.amount * 2,
        deadline: new Date(Date.now() + 86400000 * 30),
        status: 'IN_PROGRESS',
      },
    });

    const appId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appId,
        assignmentId: assignId,
        applicantId: params.talentId,
        coverLetter: 'Application for project',
        proposedRate: params.amount,
        status: 'ACCEPTED',
      },
    });

    const projId = generateUuidV7();
    return prisma.project.create({
      data: {
        id: projId,
        assignmentId: assignId,
        applicationId: appId,
        clientId: params.clientId,
        talentId: params.talentId,
        title: params.title || 'Independent Project',
        totalAmount: params.amount,
        currency: 'INR',
        status: params.status || 'IN_PROGRESS',
      },
    });
  }

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Client User (BRAND)
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    clientToken = await createTestJwt({
      sub: `sub_disp_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `disp_client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedClient: any = await defaultJwtVerifier.verifyToken(clientToken);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: decodedClient.sub,
        email: decodedClient.email,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'BRAND' },
                create: { id: generateUuidV7(), name: 'BRAND' },
              },
            },
          },
        },
        brandProfile: {
          create: {
            id: clientBrandProfileId,
            companyName: 'Apex Brands India',
          },
        },
      },
    });

    // 2. Talent User (CREATOR)
    talentUserId = generateUuidV7();
    talentToken = await createTestJwt({
      sub: `sub_disp_talent_${generateUuidV7().replace(/-/g, '')}`,
      email: `disp_talent_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedTalent: any = await defaultJwtVerifier.verifyToken(talentToken);
    await prisma.user.create({
      data: {
        id: talentUserId,
        supabaseAuthId: decodedTalent.sub,
        email: decodedTalent.email,
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

    // 3. Platform Administrator
    adminUserId = generateUuidV7();
    adminToken = await createTestJwt({
      sub: `sub_disp_admin_${generateUuidV7().replace(/-/g, '')}`,
      email: `disp_admin_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedAdmin: any = await defaultJwtVerifier.verifyToken(adminToken);
    await prisma.user.create({
      data: {
        id: adminUserId,
        supabaseAuthId: decodedAdmin.sub,
        email: decodedAdmin.email,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'ADMIN' },
                create: { id: generateUuidV7(), name: 'ADMIN' },
              },
            },
          },
        },
      },
    });

    // 4. Admin Who is Also a Client (for Anti-Conflict-of-Interest Tests)
    adminAsClientUserId = generateUuidV7();
    adminAsClientToken = await createTestJwt({
      sub: `sub_disp_admin_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `disp_admin_client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedAdminClient: any = await defaultJwtVerifier.verifyToken(adminAsClientToken);
    await prisma.user.create({
      data: {
        id: adminAsClientUserId,
        supabaseAuthId: decodedAdminClient.sub,
        email: decodedAdminClient.email,
        status: 'ACTIVE',
        userRoles: {
          create: [
            {
              id: generateUuidV7(),
              role: {
                connectOrCreate: {
                  where: { name: 'ADMIN' },
                  create: { id: generateUuidV7(), name: 'ADMIN' },
                },
              },
            },
            {
              id: generateUuidV7(),
              role: {
                connectOrCreate: {
                  where: { name: 'BRAND' },
                  create: { id: generateUuidV7(), name: 'BRAND' },
                },
              },
            },
          ],
        },
        brandProfile: {
          create: {
            id: generateUuidV7(),
            companyName: 'Admin Owned Brand',
          },
        },
      },
    });

    // 5. Bystander User
    bystanderUserId = generateUuidV7();
    bystanderToken = await createTestJwt({
      sub: `sub_disp_bystander_${generateUuidV7().replace(/-/g, '')}`,
      email: `disp_bystander_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedBystander: any = await defaultJwtVerifier.verifyToken(bystanderToken);
    await prisma.user.create({
      data: {
        id: bystanderUserId,
        supabaseAuthId: decodedBystander.sub,
        email: decodedBystander.email,
        status: 'ACTIVE',
      },
    });

    // 6. Media Assets: Active (Scanned Clean) & Quarantined
    activeMediaAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: activeMediaAssetId,
        userId: clientUserId,
        storageKey: `active/dispute-evidence-${activeMediaAssetId}.jpg`,
        originalName: 'evidence_screenshot.jpg',
        mimeType: 'image/jpeg',
        byteSize: 10240,
        mediaType: 'IMAGE',
        status: 'ACTIVE',
      },
    });

    quarantinedMediaAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: quarantinedMediaAssetId,
        userId: clientUserId,
        storageKey: `quarantine/suspect-${quarantinedMediaAssetId}.exe`,
        originalName: 'suspect.exe',
        mimeType: 'application/octet-stream',
        byteSize: 2048,
        mediaType: 'DOCUMENT',
        status: 'QUARANTINED',
      },
    });

    // 7. Base Assignment, Application, Project & Deliverable Fixtures
    assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: clientBrandProfileId,
        title: 'Q4 Brand Video Campaign',
        description: 'Complete video editing and thumbnail creation',
        budgetMin: 50000,
        budgetMax: 200000,
        deadline: new Date(Date.now() + 86400000 * 30),
        status: 'IN_PROGRESS',
      },
    });

    applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: talentUserId,
        coverLetter: 'Expert video editor with DaVinci Resolve',
        proposedRate: paymentAmount,
        status: 'ACCEPTED',
      },
    });

    projectId = generateUuidV7();
    deliverableId = generateUuidV7();
    await prisma.project.create({
      data: {
        id: projectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Q4 Brand Video Campaign',
        totalAmount: paymentAmount,
        currency: 'INR',
        status: 'IN_PROGRESS',
        deliverables: {
          create: [
            {
              id: deliverableId,
              title: 'First Cut Video',
              amount: paymentAmount,
              status: 'PENDING',
            },
          ],
        },
      },
    });

    // 8. Capture Escrow Payment for the Project
    const createIntentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId,
        deliverableId,
        amount: paymentAmount,
        currency: 'INR',
        provider: 'SANDBOX_MOCK',
        idempotencyKey: `idemp_disp_init_${generateUuidV7().substring(0, 10)}`,
      },
    });
    expect(createIntentRes.statusCode).toBe(201);
    capturedPaymentIntentId = createIntentRes.json().id;

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${capturedPaymentIntentId}/confirm`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        providerPaymentId: `pay_mock_disp_${generateUuidV7().substring(0, 8)}`,
      },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('SUCCEEDED');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Dispute Lifecycle & Guarded Transitions', () => {
    let testDisputeId: string;

    it('allows an authorized client to open a dispute on an active project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/disputes',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          projectId,
          deliverableId,
          reason: 'DELIVERABLE_POOR_QUALITY',
          description: 'The submitted work does not meet the agreed color grading specs.',
          evidenceMediaAssetIds: [activeMediaAssetId],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.projectId).toBe(projectId);
      expect(body.status).toBe('OPEN');
      expect(body.reason).toBe('DELIVERABLE_POOR_QUALITY');
      expect(body.evidence).toHaveLength(1);
      expect(body.history).toBeDefined();

      testDisputeId = body.id;

      // Project status should now be frozen in DISPUTED state
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      expect(project?.status).toBe('DISPUTED');
    });

    it('rejects opening a duplicate active dispute on the same project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/disputes',
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          projectId,
          reason: 'SCOPE_MISMATCH',
          description: 'Another dispute while one is already active.',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('DISPUTE_ALREADY_OPEN');
    });

    it('rejects attaching quarantined media assets as dispute evidence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${testDisputeId}/evidence`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          mediaAssetId: quarantinedMediaAssetId,
          title: 'Malicious or Unscanned Evidence',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_MEDIA_STATE');
    });

    it('allows attaching active media evidence to an open dispute', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${testDisputeId}/evidence`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          mediaAssetId: activeMediaAssetId,
          title: 'Timeline Comparison Screenshot',
          description: 'Frame 1024 artifacting preview',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().title).toBe('Timeline Comparison Screenshot');
    });

    it('prevents non-admins from transitioning dispute status', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/disputes/${testDisputeId}/status`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          status: 'UNDER_REVIEW',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('allows an administrator to transition dispute to UNDER_REVIEW', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/disputes/${testDisputeId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'UNDER_REVIEW',
          notes: 'Assigned to Trust & Safety specialist',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('UNDER_REVIEW');
    });

    it('allows an administrator to request evidence with a deadline', async () => {
      const deadline = new Date(Date.now() + 86400000 * 7).toISOString();
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/disputes/${testDisputeId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'EVIDENCE_REQUESTED',
          notes: 'Please provide raw timeline files',
          evidenceDeadline: deadline,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('EVIDENCE_REQUESTED');
      expect(res.json().deadline).toBe(deadline);
    });

    it('prevents invalid backward or illegal dispute transitions', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/disputes/${testDisputeId}/status`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          status: 'OPEN', // Invalid transition from EVIDENCE_REQUESTED
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_DISPUTE_STATE');
    });

    it('prevents an administrator who is also a project participant from resolving their own dispute', async () => {
      // Create project where adminAsClient is the client
      const selfDisputeProject = await createIndependentProject({
        clientId: adminAsClientUserId,
        talentId: talentUserId,
        amount: 50000,
        title: 'Admin Conflict Project',
      });
      const selfDisputeProjectId = selfDisputeProject.id;

      const openRes = await app.inject({
        method: 'POST',
        url: '/api/v1/disputes',
        headers: { authorization: `Bearer ${adminAsClientToken}` },
        payload: {
          projectId: selfDisputeProjectId,
          reason: 'MISSED_DEADLINE',
          description: 'Conflict of interest test dispute',
        },
      });
      expect(openRes.statusCode).toBe(201);
      const conflictDisputeId = openRes.json().id;

      const resolveRes = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${conflictDisputeId}/resolve`,
        headers: { authorization: `Bearer ${adminAsClientToken}` },
        payload: {
          resolution: 'RESOLVED_FOR_CLIENT',
          resolutionReason: 'Arbitrating in my own favor',
        },
      });

      expect(resolveRes.statusCode).toBe(403);
      expect(resolveRes.json().code).toBe('SELF_DISPUTE_RESOLUTION_NOT_ALLOWED');
    });

    it('allows an independent administrator to resolve dispute for client', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${testDisputeId}/resolve`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          resolution: 'RESOLVED_FOR_CLIENT',
          resolutionReason: 'Defective deliverables confirmed upon technical audit.',
          refundAmount: paymentAmount,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('RESOLVED_FOR_CLIENT');
      expect(res.json().resolvedById).toBe(adminUserId);
      expect(res.json().resolutionReason).toBe(
        'Defective deliverables confirmed upon technical audit.',
      );
    });

    it('allows an administrator to close a resolved dispute', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${testDisputeId}/close`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('CLOSED');
      expect(res.json().closedAt).toBeDefined();
    });

    it('rejects adding evidence to a closed dispute', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${testDisputeId}/evidence`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          title: 'Belated Evidence',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_DISPUTE_STATE');
    });
  });

  describe('2. Authorization Boundaries & Evidence Privacy', () => {
    it('prevents unauthorized bystanders from viewing disputes', async () => {
      const openRes = await app.inject({
        method: 'GET',
        url: '/api/v1/disputes',
        headers: { authorization: `Bearer ${bystanderToken}` },
      });

      expect(openRes.statusCode).toBe(200);
      expect(openRes.json()).toHaveLength(0); // Kept private, bystander sees none
    });

    it('prevents unauthorized bystanders from accessing a specific dispute by ID', async () => {
      const disputes = await prisma.dispute.findMany({ take: 1 });
      const targetDisputeId = disputes[0]!.id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/disputes/${targetDisputeId}`,
        headers: { authorization: `Bearer ${bystanderToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('prevents unauthorized bystanders from adding evidence', async () => {
      const disputes = await prisma.dispute.findMany({ take: 1 });
      const targetDisputeId = disputes[0]!.id;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/disputes/${targetDisputeId}/evidence`,
        headers: { authorization: `Bearer ${bystanderToken}` },
        payload: {
          title: 'Unauthorized injection',
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('3. Project Cancellation Workflow & Mutual Consent', () => {
    let testCancellationProjectId: string;
    let cancellationId: string;

    beforeAll(async () => {
      const cancelProject = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 60000,
        title: 'Mutual Cancellation Test Project',
      });
      testCancellationProjectId = cancelProject.id;
    });

    it('allows client to submit a project cancellation request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testCancellationProjectId}/cancellations`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          reason: 'Client company reprioritized marketing objectives.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('PENDING');
      expect(body.requestedById).toBe(clientUserId);

      cancellationId = body.id;
    });

    it('prevents requesting another cancellation while one is already pending', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testCancellationProjectId}/cancellations`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          reason: 'Duplicate cancellation attempt',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('PROJECT_CANCELLATION_CONFLICT');
    });

    it('prevents the requester from approving their own cancellation request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testCancellationProjectId}/cancellations/${cancellationId}/decide`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          action: 'APPROVE',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('allows the requester to withdraw their pending cancellation request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testCancellationProjectId}/cancellations/${cancellationId}/withdraw`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('WITHDRAWN');
    });

    it('allows counterparty (talent) to approve a new cancellation request, cancelling project', async () => {
      const requestRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testCancellationProjectId}/cancellations`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          reason: 'Mutual agreement reached to cancel.',
        },
      });
      expect(requestRes.statusCode).toBe(201);
      const newCancellationId = requestRes.json().id;

      const decideRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${testCancellationProjectId}/cancellations/${newCancellationId}/decide`,
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          action: 'APPROVE',
          decisionReason: 'Talent agrees to cancel cleanly.',
        },
      });

      expect(decideRes.statusCode).toBe(200);
      expect(decideRes.json().status).toBe('APPROVED');

      // Verify project transitioned to CANCELLED
      const project = await prisma.project.findUnique({
        where: { id: testCancellationProjectId },
      });
      expect(project?.status).toBe('CANCELLED');
      expect(project?.cancelledAt).toBeDefined();
    });
  });

  describe('4. Refund Orchestration & Double-Entry Financial Invariants', () => {
    let refundPaymentIntentId: string;
    let refundProjectId: string;
    const testAmount = 50000; // 500 INR (50,000 paisa)

    beforeAll(async () => {
      const refundProject = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: testAmount,
        title: 'Refund Invariant Test Project',
      });
      refundProjectId = refundProject.id;

      const intentRes = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/intents',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          projectId: refundProjectId,
          amount: testAmount,
          currency: 'INR',
          provider: 'SANDBOX_MOCK',
          idempotencyKey: `idemp_rfnd_setup_${generateUuidV7().substring(0, 8)}`,
        },
      });
      expect(intentRes.statusCode).toBe(201);
      refundPaymentIntentId = intentRes.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/confirm`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          providerPaymentId: `pay_mock_rfnd_${generateUuidV7().substring(0, 8)}`,
        },
      });
    });

    it('processes an idempotent partial refund and posts balanced ledger entries', async () => {
      const partialAmount = 20000; // 200 INR (20,000 paisa)
      const idempotencyKey = `idemp_partial_${generateUuidV7().substring(0, 10)}`;

      const initialEscrowBalance = await ledgerService.getProjectEscrowBalance(refundProjectId);
      expect(initialEscrowBalance).toBe(45000); // 50,000 - 10% fee = 45,000 paisa

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/refunds`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          amount: partialAmount,
          reason: 'CLIENT_REQUESTED',
          idempotencyKey,
        },
      });

      expect(res.statusCode).toBe(201);
      const refund = res.json();
      expect(refund.id).toBeDefined();
      expect(refund.amount).toBe(partialAmount);
      expect(refund.status).toBe('SUCCEEDED');
      expect(refund.providerRefundId).toBeDefined();

      // Verify PaymentIntent is now PARTIALLY_REFUNDED
      const intent = await prisma.paymentIntent.findUnique({
        where: { id: refundPaymentIntentId },
      });
      expect(intent?.status).toBe('PARTIALLY_REFUNDED');

      // Verify balanced ledger entry:
      // Escrow reversal: 20,000 - 10% = 18,000 paisa
      // New escrow holding balance: 45,000 - 18,000 = 27,000 paisa
      const newEscrowBalance = await ledgerService.getProjectEscrowBalance(refundProjectId);
      expect(newEscrowBalance).toBe(27000);

      // Verify idempotent replay returns cached response
      const replayRes = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/refunds`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          amount: partialAmount,
          reason: 'CLIENT_REQUESTED',
          idempotencyKey,
        },
      });
      expect(replayRes.statusCode).toBe(201);
      expect(replayRes.json().id).toBe(refund.id);

      // Verify idempotency conflict when same key used with different payload
      const conflictRes = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/refunds`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          amount: partialAmount + 5000,
          reason: 'CLIENT_REQUESTED',
          idempotencyKey,
        },
      });
      expect(conflictRes.statusCode).toBe(409);
      expect(conflictRes.json().code).toBe('IDEMPOTENCY_CONFLICT');
    });

    it('rejects refund amount exceeding remaining refundable balance', async () => {
      // Remaining refundable: 50,000 - 20,000 = 30,000 paisa
      const excessiveAmount = 35000;

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/refunds`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          amount: excessiveAmount,
          reason: 'CLIENT_REQUESTED',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('REFUND_EXCEEDS_CAPTURABLE_AMOUNT');
    });

    it('processes remaining refund to reach fully REFUNDED status with zero balance drift', async () => {
      const remainingAmount = 30000; // exactly 30,000 paisa
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/refunds`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          amount: remainingAmount,
          reason: 'PROJECT_CANCELLED',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().status).toBe('SUCCEEDED');

      // Intent should now be REFUNDED
      const intent = await prisma.paymentIntent.findUnique({
        where: { id: refundPaymentIntentId },
      });
      expect(intent?.status).toBe('REFUNDED');

      // Escrow holding balance should now be exactly 0
      const finalEscrowBalance = await ledgerService.getProjectEscrowBalance(refundProjectId);
      expect(finalEscrowBalance).toBe(0);
    });

    it('rejects further refund attempts on a fully REFUNDED payment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/intents/${refundPaymentIntentId}/refunds`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          amount: 100,
          reason: 'CLIENT_REQUESTED',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe('INVALID_REFUND_STATE');
    });
  });

  describe('5. Webhook Reconciliation & Recovery', () => {
    it('reconciles processing refund via signed provider refund webhook', async () => {
      // Create a refund record in PROCESSING status
      const procProject = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 10000,
        title: 'Webhook Reconcile Project',
      });
      const procProjectId = procProject.id;

      const intent = await prisma.paymentIntent.create({
        data: {
          id: generateUuidV7(),
          projectId: procProjectId,
          clientId: clientUserId,
          amount: 10000,
          currency: 'INR',
          platformFee: 1000,
          status: 'SUCCEEDED',
          provider: 'SANDBOX_MOCK',
          providerPaymentId: `pay_mock_rec_${generateUuidV7().substring(0, 8)}`,
        },
      });

      // Credit escrow initially so reversal can balance
      await ledgerService.postTransaction({
        paymentIntentId: intent.id,
        type: 'PAYMENT_CAPTURED',
        entries: [
          {
            accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: 10000,
            currency: 'INR',
          },
          {
            accountCode: `LIABILITIES:ESCROW_HOLDING:${procProjectId}`,
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: 9000,
            currency: 'INR',
            projectId: procProjectId,
          },
          {
            accountCode: 'REVENUE:PLATFORM_FEE',
            accountType: 'REVENUE',
            direction: 'CREDIT',
            amount: 1000,
            currency: 'INR',
          },
        ],
      });

      const providerRefundId = `rfnd_mock_hook_${generateUuidV7().substring(0, 10)}`;
      const pendingRefund = await prisma.refund.create({
        data: {
          id: generateUuidV7(),
          paymentIntentId: intent.id,
          projectId: procProjectId,
          refundedById: clientUserId,
          amount: 10000,
          currency: 'INR',
          reason: 'CLIENT_REQUESTED',
          status: 'PROCESSING',
          provider: 'SANDBOX_MOCK',
          providerRefundId,
        },
      });

      const webhookPayload = JSON.stringify({
        id: `evt_rfnd_${generateUuidV7()}`,
        event: 'refund.processed',
        payload: {
          refund: {
            id: providerRefundId,
            amount: 10000,
            currency: 'INR',
          },
          payment: {
            id: intent.providerPaymentId,
          },
        },
      });

      const signature = crypto
        .createHmac('sha256', testWebhookSecret)
        .update(webhookPayload)
        .digest('hex');

      const hookRes = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhooks/SANDBOX_MOCK',
        headers: {
          'x-webhook-signature': signature,
          'content-type': 'application/json',
        },
        payload: webhookPayload,
      });

      expect(hookRes.statusCode).toBe(200);
      expect(hookRes.json().status).toBe('PROCESSED');

      // Verify refund transitioned to SUCCEEDED
      const updatedRefund = await prisma.refund.findUnique({
        where: { id: pendingRefund.id },
      });
      expect(updatedRefund?.status).toBe('SUCCEEDED');

      // Verify duplicate webhook returns ALREADY_PROCESSED
      const dupHookRes = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhooks/SANDBOX_MOCK',
        headers: {
          'x-webhook-signature': signature,
          'content-type': 'application/json',
        },
        payload: webhookPayload,
      });
      expect(dupHookRes.statusCode).toBe(200);
      expect(dupHookRes.json().status).toBe('ALREADY_PROCESSED');
    });

    it('allows administrator to manually reconcile a refund in PROCESSING status', async () => {
      const recProject = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 15000,
        title: 'Manual Reconcile Project',
      });
      const recProjectId = recProject.id;

      const intent = await prisma.paymentIntent.create({
        data: {
          id: generateUuidV7(),
          projectId: recProjectId,
          clientId: clientUserId,
          amount: 15000,
          currency: 'INR',
          platformFee: 1500,
          status: 'SUCCEEDED',
          provider: 'SANDBOX_MOCK',
        },
      });

      await ledgerService.postTransaction({
        paymentIntentId: intent.id,
        type: 'PAYMENT_CAPTURED',
        entries: [
          {
            accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: 15000,
            currency: 'INR',
          },
          {
            accountCode: `LIABILITIES:ESCROW_HOLDING:${recProjectId}`,
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: 13500,
            currency: 'INR',
            projectId: recProjectId,
          },
          {
            accountCode: 'REVENUE:PLATFORM_FEE',
            accountType: 'REVENUE',
            direction: 'CREDIT',
            amount: 1500,
            currency: 'INR',
          },
        ],
      });

      const procRefund = await prisma.refund.create({
        data: {
          id: generateUuidV7(),
          paymentIntentId: intent.id,
          projectId: recProjectId,
          refundedById: clientUserId,
          amount: 15000,
          currency: 'INR',
          reason: 'ADMIN_ADJUSTMENT',
          status: 'PROCESSING',
          provider: 'SANDBOX_MOCK',
          providerRefundId: `rfnd_manual_${generateUuidV7()}`,
        },
      });

      const reconcileRes = await app.inject({
        method: 'POST',
        url: `/api/v1/payments/refunds/${procRefund.id}/reconcile`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(reconcileRes.statusCode).toBe(200);
      expect(reconcileRes.json().status).toBe('SUCCEEDED');

      const finalRefund = await prisma.refund.findUnique({
        where: { id: procRefund.id },
      });
      expect(finalRefund?.status).toBe('SUCCEEDED');
    });
  });
});
