import { describe, expect, it, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getPrismaClient,
  notificationRepository,
  type PrismaClient,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { ledgerService } from '../payments/ledger/ledger.service.js';
import { NotificationEventHandler } from '../../../../worker/src/notifications/notification-event-handler.js';

describe('Phase 6: Project Deliverables, Milestone Lifecycle & Escrow Integration', () => {
  let app: FastifyInstance;
  const prisma: PrismaClient = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let talentUserId: string;
  let talentToken: string;

  let bystanderUserId: string;
  let bystanderToken: string;

  let suspendedUserId: string;
  let suspendedToken: string;

  let projectId: string;
  let deliverable1Id: string;
  let deliverable2Id: string;

  let cleanAssetId: string;
  let quarantinedAssetId: string;
  let pendingScanAssetId: string;
  let rejectedAssetId: string;
  let foreignAssetId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    // 1. Client user (Brand)
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    const clientSub = `sub_client_p6_${ts}`;
    const clientEmail = `client_p6_${ts}@test.com`;
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: clientSub,
        email: clientEmail,
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
            companyName: 'Apex Brand Media',
          },
        },
      },
    });
    clientToken = await createTestJwt({ sub: clientSub, email: clientEmail });

    // 2. Talent user (Creator)
    talentUserId = generateUuidV7();
    const talentSub = `sub_talent_p6_${ts}`;
    const talentEmail = `talent_p6_${ts}@test.com`;
    await prisma.user.create({
      data: {
        id: talentUserId,
        supabaseAuthId: talentSub,
        email: talentEmail,
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
    talentToken = await createTestJwt({ sub: talentSub, email: talentEmail });

    // 3. Bystander user
    bystanderUserId = generateUuidV7();
    const bystanderSub = `sub_bystander_p6_${ts}`;
    const bystanderEmail = `bystander_p6_${ts}@test.com`;
    await prisma.user.create({
      data: {
        id: bystanderUserId,
        supabaseAuthId: bystanderSub,
        email: bystanderEmail,
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
    bystanderToken = await createTestJwt({ sub: bystanderSub, email: bystanderEmail });

    // 4. Suspended user
    suspendedUserId = generateUuidV7();
    const suspendedSub = `sub_suspended_p6_${ts}`;
    const suspendedEmail = `suspended_p6_${ts}@test.com`;
    await prisma.user.create({
      data: {
        id: suspendedUserId,
        supabaseAuthId: suspendedSub,
        email: suspendedEmail,
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
    suspendedToken = await createTestJwt({ sub: suspendedSub, email: suspendedEmail });

    // 5. Assignment & Application
    const assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: clientBrandProfileId,
        title: 'Video Campaign Milestone Project',
        description: 'End to end milestone delivery contract',
        budgetMin: 100000,
        budgetMax: 100000,
        deadline: new Date(Date.now() + 86400000 * 30),
        status: 'PUBLISHED',
      },
    });

    const applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: talentUserId,
        coverLetter: 'Ready to produce deliverables on time',
        proposedRate: 100000,
        status: 'ACCEPTED',
      },
    });

    // 6. Create Project with 2 Deliverables (50,000 paisa each)
    projectId = generateUuidV7();
    deliverable1Id = generateUuidV7();
    deliverable2Id = generateUuidV7();

    await prisma.project.create({
      data: {
        id: projectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Video Campaign Project',
        totalAmount: 100000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
        deliverables: {
          create: [
            {
              id: deliverable1Id,
              title: 'Milestone 1: Script & Storyboard',
              description: 'Initial creative storyboard',
              amount: 50000,
              status: 'PENDING',
              version: 1,
            },
            {
              id: deliverable2Id,
              title: 'Milestone 2: Final Edited 4K Video',
              description: 'Completed video file in 4K',
              amount: 50000,
              status: 'PENDING',
              version: 1,
            },
          ],
        },
      },
    });

    // 7. Seed Media Assets for Talent
    cleanAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: cleanAssetId,
        userId: talentUserId,
        storageKey: `deliverables/${cleanAssetId}.mp4`,
        originalName: 'final_cut.mp4',
        mimeType: 'video/mp4',
        byteSize: 1024 * 1024 * 5,
        mediaType: 'VIDEO',
        status: 'ACTIVE',
      },
    });

    quarantinedAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: quarantinedAssetId,
        userId: talentUserId,
        storageKey: `deliverables/${quarantinedAssetId}.mp4`,
        originalName: 'unscanned.mp4',
        mimeType: 'video/mp4',
        byteSize: 1024 * 1024 * 5,
        mediaType: 'VIDEO',
        status: 'QUARANTINED',
      },
    });

    pendingScanAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: pendingScanAssetId,
        userId: talentUserId,
        storageKey: `deliverables/${pendingScanAssetId}.mp4`,
        originalName: 'scanning.mp4',
        mimeType: 'video/mp4',
        byteSize: 1024 * 1024 * 5,
        mediaType: 'VIDEO',
        status: 'PENDING_SCAN',
      },
    });

    rejectedAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: rejectedAssetId,
        userId: talentUserId,
        storageKey: `deliverables/${rejectedAssetId}.mp4`,
        originalName: 'infected.mp4',
        mimeType: 'video/mp4',
        byteSize: 1024 * 1024 * 5,
        mediaType: 'VIDEO',
        status: 'REJECTED_INVALID',
      },
    });

    foreignAssetId = generateUuidV7();
    await prisma.mediaAsset.create({
      data: {
        id: foreignAssetId,
        userId: bystanderUserId,
        storageKey: `deliverables/${foreignAssetId}.mp4`,
        originalName: 'bystander_file.mp4',
        mimeType: 'video/mp4',
        byteSize: 1024 * 1024 * 2,
        mediaType: 'VIDEO',
        status: 'ACTIVE',
      },
    });

    // 8. Fund Project Escrow with 100,000 paisa in Ledger
    await ledgerService.postTransaction({
      type: 'ESCROW_FUNDING',
      description: `Funded project ${projectId} escrow balance`,
      entries: [
        {
          accountCode: 'ASSETS:PLATFORM_BANK:INR',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 100000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
          accountName: `Project Escrow Holding for ${projectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 100000,
          currency: 'INR',
          projectId,
        },
      ],
    });
  });

  // ===========================================================================
  // Section A: Milestone Management & Permissions
  // ===========================================================================

  it('lists milestones for authorized project participants', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/milestones`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(200);
    const milestones = res.json();
    expect(milestones).toHaveLength(2);
    expect(milestones[0].id).toBe(deliverable1Id);
    expect(milestones[0].status).toBe('PENDING');
    expect(milestones[0].amount).toBe(50000);
  });

  it('allows client to add a new milestone to an in-progress project', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/milestones`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        title: 'Milestone 3: Teaser Trailer',
        description: '30-second teaser for social media',
        amount: 25000,
      },
    });

    expect(res.statusCode).toBe(201);
    const created = res.json();
    expect(created.title).toBe('Milestone 3: Teaser Trailer');
    expect(created.status).toBe('PENDING');
    expect(created.amount).toBe(25000);

    // Verify project totalAmount incremented to 125,000
    const projectRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(projectRes.json().totalAmount).toBe(125000);
  });

  it('allows client to edit a pending milestone', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/milestones/${deliverable1Id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        title: 'Milestone 1: Revised Storyboard & Script',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe('Milestone 1: Revised Storyboard & Script');
  });

  it('rejects talent or third party attempting to add or edit milestones', async () => {
    const talentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/milestones`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        title: 'Unauthorized Milestone',
        amount: 10000,
      },
    });
    expect(talentRes.statusCode).toBe(403);

    const bystanderRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/milestones/${deliverable1Id}`,
      headers: { authorization: `Bearer ${bystanderToken}` },
      payload: { title: 'Bystander Tamper' },
    });
    expect(bystanderRes.statusCode).toBe(403);
  });

  // ===========================================================================
  // Section B: Attachment Security & Account Status Guards
  // ===========================================================================

  it('rejects deliverable submission with an attachment owned by another user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: foreignAssetId,
        submissionNotes: 'Trying to submit bystander asset',
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('FORBIDDEN');
  });

  it('rejects deliverable submission when attachment is in QUARANTINED state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: quarantinedAssetId,
        submissionNotes: 'Submitting unscanned asset',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ATTACHMENT_SCAN_PENDING');
  });

  it('rejects deliverable submission when attachment is in PENDING_SCAN state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: pendingScanAssetId,
        submissionNotes: 'Submitting pending scan asset',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ATTACHMENT_SCAN_PENDING');
  });

  it('rejects deliverable submission when attachment failed virus scan (REJECTED_INVALID)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: rejectedAssetId,
        submissionNotes: 'Submitting infected file',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ATTACHMENT_REJECTED');
  });

  it('rejects suspended accounts from submitting or reviewing deliverables', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${suspendedToken}` },
      payload: { submissionNotes: 'Suspended user action' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('USER_SUSPENDED');
  });

  // ===========================================================================
  // Section C: Deliverable Submission & Revision Journey (v1 -> Revision -> v2)
  // ===========================================================================

  it('allows talent to submit deliverable v1 with clean verified attachment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: cleanAssetId,
        submissionNotes: 'Version 1 storyboard draft for review',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(deliverable1Id);
    expect(body.status).toBe('SUBMITTED');
    expect(body.version).toBe(1);
    expect(body.submittedAssetId).toBe(cleanAssetId);
    expect(body.submissionNotes).toBe('Version 1 storyboard draft for review');

    // Verify submission record created in DB
    const submissions = await prisma.projectDeliverableSubmission.findMany({
      where: { deliverableId: deliverable1Id },
    });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].version).toBe(1);
    expect(submissions[0].reviewStatus).toBe('SUBMITTED');

    // Verify outbox event emitted
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: deliverable1Id,
        eventType: 'project.deliverable.submitted.v1',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).not.toBeNull();
  });

  it('rejects milestone editing once submission has commenced', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/projects/${projectId}/milestones/${deliverable1Id}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { title: 'Attempt to tamper submitted milestone' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('MILESTONE_NOT_EDITABLE');
  });

  it('allows client to request revisions with feedback notes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        action: 'REQUEST_REVISION',
        notes: 'Please update scenes 3 and 4 to include brand product placement.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('REVISION_REQUESTED');
    expect(body.revisionNotes).toBe(
      'Please update scenes 3 and 4 to include brand product placement.',
    );

    // Verify submission record v1 marked REVISION_REQUESTED with review notes
    const subV1 = await prisma.projectDeliverableSubmission.findUniqueOrThrow({
      where: {
        deliverableId_version: {
          deliverableId: deliverable1Id,
          version: 1,
        },
      },
    });
    expect(subV1.reviewStatus).toBe('REVISION_REQUESTED');
    expect(subV1.reviewNotes).toBe(
      'Please update scenes 3 and 4 to include brand product placement.',
    );
    expect(subV1.reviewedById).toBe(clientUserId);
    expect(subV1.reviewedAt).not.toBeNull();
  });

  it('allows talent to submit revised version 2 preserving history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: cleanAssetId,
        submissionNotes: 'Version 2 with requested product placement added in scenes 3 and 4.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('SUBMITTED');
    expect(body.version).toBe(2);
    expect(body.submissionNotes).toBe(
      'Version 2 with requested product placement added in scenes 3 and 4.',
    );

    // Verify both v1 and v2 records exist in database
    const submissions = await prisma.projectDeliverableSubmission.findMany({
      where: { deliverableId: deliverable1Id },
      orderBy: { version: 'asc' },
    });
    expect(submissions).toHaveLength(2);
    expect(submissions[0].version).toBe(1);
    expect(submissions[0].reviewStatus).toBe('REVISION_REQUESTED');
    expect(submissions[1].version).toBe(2);
    expect(submissions[1].reviewStatus).toBe('SUBMITTED');
  });

  it('retrieves chronological submission history via API', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submissions`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(200);
    const history = res.json();
    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(1);
    expect(history[0].reviewStatus).toBe('REVISION_REQUESTED');
    expect(history[1].version).toBe(2);
    expect(history[1].reviewStatus).toBe('SUBMITTED');
  });

  it('authorizes participants to fetch deliverable attachment metadata and download URL', async () => {
    // Client retrieves talent's submitted attachment
    const clientRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/attachments/${cleanAssetId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(clientRes.statusCode).toBe(200);
    const clientBody = clientRes.json();
    expect(clientBody.id).toBe(cleanAssetId);
    expect(clientBody.status).toBe('ACTIVE');
    expect(clientBody.downloadUrl).not.toBeNull();

    // Outsider is rejected
    const bystanderRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/attachments/${cleanAssetId}`,
      headers: { authorization: `Bearer ${bystanderToken}` },
    });
    expect(bystanderRes.statusCode).toBe(404);
  });

  // ===========================================================================
  // Section D: Client Acceptance & Financial Ledger Escrow Release
  // ===========================================================================

  it('approves deliverable and releases milestone escrow via explicit approval gate', async () => {
    // Escrow balance before approval = 100,000 paisa
    const escrowBefore = await ledgerService.getProjectEscrowBalance(projectId);
    expect(escrowBefore).toBe(100000);

    const payableBefore = await ledgerService.getCreatorPayableBalance(talentUserId);
    expect(payableBefore).toBe(0);

    // Client approves deliverable v2
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        action: 'APPROVE',
        notes: 'Excellent work, approved without further revisions.',
      },
    });

    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().status).toBe('APPROVED');

    // Verify submission record v2 marked APPROVED
    const subV2 = await prisma.projectDeliverableSubmission.findUniqueOrThrow({
      where: {
        deliverableId_version: {
          deliverableId: deliverable1Id,
          version: 2,
        },
      },
    });
    expect(subV2.reviewStatus).toBe('APPROVED');
    expect(subV2.reviewedById).toBe(clientUserId);

    // Client explicitly releases milestone escrow funds
    const releaseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${projectId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(releaseRes.statusCode).toBe(200);
    expect(releaseRes.json().releasedAmount).toBe(100000);

    // Verify Ledger: 100,000 paisa transferred from Escrow Holding to Creator Payable
    const escrowAfter = await ledgerService.getProjectEscrowBalance(projectId);
    expect(escrowAfter).toBe(0);

    const payableAfter = await ledgerService.getCreatorPayableBalance(talentUserId);
    expect(payableAfter).toBe(100000);

    // Verify outbox event emitted
    const releaseEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: projectId,
        eventType: 'escrow.released.v1',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(releaseEvent).not.toBeNull();
    expect((releaseEvent?.payload as any).releasedAmount).toBe(100000);
  });

  it('rejects duplicate acceptance or revision requests on an already approved deliverable', async () => {
    // Repeated approval attempt
    const repeatApprove = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { action: 'APPROVE' },
    });
    expect(repeatApprove.statusCode).toBe(400);
    expect(repeatApprove.json().code).toBe('DELIVERABLE_STATE_ERROR');

    // Attempting revision on approved deliverable
    const revisionAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { action: 'REQUEST_REVISION', notes: 'Try to un-approve' },
    });
    expect(revisionAttempt.statusCode).toBe(400);
    expect(revisionAttempt.json().code).toBe('DELIVERABLE_STATE_ERROR');

    // Attempting to re-submit on approved deliverable
    const submitAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: { submissionNotes: 'Submit again' },
    });
    expect(submitAttempt.statusCode).toBe(400);
    expect(submitAttempt.json().code).toBe('DELIVERABLE_STATE_ERROR');

    // Verify creator payable balance did not increase again (strictly unchanged at 100,000)
    const payableBalance = await ledgerService.getCreatorPayableBalance(talentUserId);
    expect(payableBalance).toBe(100000);
  });

  // ===========================================================================
  // Section E: Idempotency Protection
  // ===========================================================================

  it('safely handles replayed requests with idempotencyKey without creating duplicates', async () => {
    const idempotencyKey = `idem_submit_${Date.now()}`;

    // First call
    const firstRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable2Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: cleanAssetId,
        submissionNotes: 'Milestone 2 final cut',
        idempotencyKey,
      },
    });
    expect(firstRes.statusCode).toBe(200);

    // Second call with same idempotencyKey
    const replayRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/deliverables/${deliverable2Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submittedAssetId: cleanAssetId,
        submissionNotes: 'Milestone 2 final cut',
        idempotencyKey,
      },
    });
    expect(replayRes.statusCode).toBe(200);

    // Verify exactly 1 submission record exists for deliverable 2
    const submissions = await prisma.projectDeliverableSubmission.findMany({
      where: { deliverableId: deliverable2Id },
    });
    expect(submissions).toHaveLength(1);
  });

  // ===========================================================================
  // Section F: Outbox Notification Event Dispatching
  // ===========================================================================

  it('delivers transactional outbox events to in-app notifications for milestone transitions', async () => {
    const handler = new NotificationEventHandler({
      prisma,
      notificationRepo: notificationRepository,
    });

    // 1. Deliverable Submitted event -> Client notification
    const submittedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: deliverable1Id,
        eventType: 'project.deliverable.submitted.v1',
      },
    });
    const subResult = await handler.dispatch(submittedEvent as any);
    expect(subResult.success).toBe(true);

    const clientNotifs = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(clientNotifs.statusCode).toBe(200);
    const clientItems = clientNotifs.json().items;
    const submittedNotif = clientItems.find((n: any) => n.type === 'DELIVERABLE_SUBMITTED');
    expect(submittedNotif).toBeDefined();

    // 2. Deliverable Approved event -> Talent notification
    const approvedEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: deliverable1Id,
        eventType: 'project.deliverable.approved.v1',
      },
    });
    const appResult = await handler.dispatch(approvedEvent as any);
    expect(appResult.success).toBe(true);

    const talentNotifs = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${talentToken}` },
    });
    expect(talentNotifs.statusCode).toBe(200);
    const talentItems = talentNotifs.json().items;
    const approvedNotif = talentItems.find((n: any) => n.type === 'DELIVERABLE_APPROVED');
    expect(approvedNotif).toBeDefined();

    // 3. Escrow Released event -> Talent notification
    const escrowEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: projectId,
        eventType: 'escrow.released.v1',
      },
    });
    const escrowResult = await handler.dispatch(escrowEvent as any);
    expect(escrowResult.success).toBe(true);

    const talentNotifsUpdated = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${talentToken}` },
    });
    const escrowNotif = talentNotifsUpdated
      .json()
      .items.find((n: any) => n.type === 'ESCROW_RELEASED');
    expect(escrowNotif).toBeDefined();
  });
});
