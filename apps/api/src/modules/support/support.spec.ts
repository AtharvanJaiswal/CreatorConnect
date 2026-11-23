import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Phase 3B: Support Ticketing, Persistence, API & Authorization', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let customerAId: string;
  let customerAToken: string;

  let customerBId: string;
  let customerBToken: string;

  let staffUserId: string;
  let staffToken: string;

  let testTicketId: string;
  let testTicketNumber: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Customer User A
    customerAId = generateUuidV7();
    customerAToken = await createTestJwt({
      sub: `sub_supp_custA_${generateUuidV7().replace(/-/g, '')}`,
      email: `supp_custA_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedA: any = await defaultJwtVerifier.verifyToken(customerAToken);
    await prisma.user.create({
      data: {
        id: customerAId,
        supabaseAuthId: decodedA.sub,
        email: decodedA.email,
        firstName: 'Kavya',
        lastName: 'Nair',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'CREATOR' } },
          },
        },
      },
    });

    // 2. Customer User B (for IDOR attack tests)
    customerBId = generateUuidV7();
    customerBToken = await createTestJwt({
      sub: `sub_supp_custB_${generateUuidV7().replace(/-/g, '')}`,
      email: `supp_custB_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedB: any = await defaultJwtVerifier.verifyToken(customerBToken);
    await prisma.user.create({
      data: {
        id: customerBId,
        supabaseAuthId: decodedB.sub,
        email: decodedB.email,
        firstName: 'Rahul',
        lastName: 'Kapoor',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'BRAND' } },
          },
        },
      },
    });

    // 3. Staff User (Admin Role)
    staffUserId = generateUuidV7();
    staffToken = await createTestJwt({
      sub: `sub_supp_staff_${generateUuidV7().replace(/-/g, '')}`,
      email: `supp_staff_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedStaff: any = await defaultJwtVerifier.verifyToken(staffToken);
    await prisma.user.create({
      data: {
        id: staffUserId,
        supabaseAuthId: decodedStaff.sub,
        email: decodedStaff.email,
        firstName: 'Anya',
        lastName: 'Sen',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'ADMIN' } },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ==============================================================================
  // 1. Ticket Creation & Validation
  // ==============================================================================

  it('rejects unauthenticated ticket creation with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/support/tickets',
      payload: {
        category: 'ESCROW_RECONCILIATION',
        subject: 'Unauthorized ticket inquiry',
        description: 'Should fail auth hook.',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('creates support ticket atomically with initial message, audit log and outbox event (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/support/tickets',
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: {
        category: 'ESCROW_RECONCILIATION',
        priority: 'HIGH',
        subject: 'Milestone #MS-02 Disbursement Reconciliation',
        description:
          'The brand approved our final deliverables yesterday afternoon, but status still displays pending.',
        escrowAmount: 120000,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBeDefined();
    expect(body.ticketNumber).toMatch(/^SUP-\d{4}-[A-Z0-9]{5}$/);
    expect(body.status).toBe('OPEN');
    expect(body.category).toBe('ESCROW_RECONCILIATION');
    expect(body.priority).toBe('HIGH');
    expect(body.escrowAmount).toBe(120000);
    expect(body.version).toBe(1);
    expect(body.requesterId).toBe(customerAId);

    testTicketId = body.id;
    testTicketNumber = body.ticketNumber;

    // Verify initial conversation message was created in database
    const initialMessage = await prisma.supportTicketMessage.findFirst({
      where: { ticketId: testTicketId },
    });
    expect(initialMessage).not.toBeNull();
    expect(initialMessage?.authorId).toBe(customerAId);
    expect(initialMessage?.authorRole).toBe('CUSTOMER');
    expect(initialMessage?.isInternal).toBe(false);

    // Verify outbox event was written in same transaction
    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: testTicketId, eventType: 'support.ticket.created.v1' },
    });
    expect(outbox).not.toBeNull();
    expect(outbox?.status).toBe('PENDING');

    // Verify platform AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: testTicketId, action: 'SUPPORT_TICKET_CREATED' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(customerAId);
  });

  // ==============================================================================
  // 2. Ticket Retrieval & IDOR Enforcement
  // ==============================================================================

  it('allows requester to retrieve their own ticket by UUID and ticket number (200)', async () => {
    // Lookup by UUID
    const resUuid = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testTicketId}`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });
    expect(resUuid.statusCode).toBe(200);
    const bodyUuid = JSON.parse(resUuid.body);
    expect(bodyUuid.id).toBe(testTicketId);
    expect(bodyUuid.ticketNumber).toBe(testTicketNumber);

    // Lookup by human-readable reference
    const resNum = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testTicketNumber}`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });
    expect(resNum.statusCode).toBe(200);
    const bodyNum = JSON.parse(resNum.body);
    expect(bodyNum.id).toBe(testTicketId);
  });

  it('strictly rejects User B from retrieving User A ticket with 403 (Anti-IDOR)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testTicketId}`,
      headers: { authorization: `Bearer ${customerBToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('SUPPORT_TICKET_FORBIDDEN');
  });

  it('lists customer tickets for requester with isolation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/support/tickets?category=ESCROW_RECONCILIATION',
      headers: { authorization: `Bearer ${customerAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((t: any) => t.id === testTicketId)).toBe(true);

    // User B list should NOT contain User A's ticket
    const resB = await app.inject({
      method: 'GET',
      url: '/api/v1/support/tickets',
      headers: { authorization: `Bearer ${customerBToken}` },
    });
    const bodyB = JSON.parse(resB.body);
    expect(bodyB.items.some((t: any) => t.id === testTicketId)).toBe(false);
  });

  // ==============================================================================
  // 3. Conversation History & Message Submission
  // ==============================================================================

  it('allows requester to post a follow-up message (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: {
        body: 'Here is the approved invoice reference for the campaign.',
        attachmentName: 'Invoice_Lookbook_MS2.pdf',
        attachmentSize: '180 KB',
        attachmentType: 'application/pdf',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.ticketId).toBe(testTicketId);
    expect(body.authorRole).toBe('CUSTOMER');
    expect(body.body).toBe('Here is the approved invoice reference for the campaign.');
    expect(body.attachmentName).toBe('Invoice_Lookbook_MS2.pdf');
  });

  it('strictly rejects User B from posting to User A ticket with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${customerBToken}` },
      payload: {
        body: 'Malicious injection attempt from unauthorized user.',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('strictly rejects User B from viewing User A message history with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${customerBToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  // ==============================================================================
  // 4. Staff Authorization & Queue Operations
  // ==============================================================================

  it('rejects regular customer from accessing staff queue with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/staff/support/tickets',
      headers: { authorization: `Bearer ${customerAToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows staff (ADMIN) to access staff queue with filters (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/staff/support/tickets?status=OPEN',
      headers: { authorization: `Bearer ${staffToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.some((t: any) => t.id === testTicketId)).toBe(true);
  });

  it('allows staff to assign ticket to a specialist (200)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${testTicketId}/assign`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        assignedToId: staffUserId,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.assignedToId).toBe(staffUserId);
    expect(body.status).toBe('IN_PROGRESS');
    expect(body.version).toBe(2);

    // Outbox event
    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: testTicketId, eventType: 'support.ticket.assigned.v1' },
    });
    expect(outbox).not.toBeNull();
  });

  it('allows staff to post an official response message to customer (201)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        body: 'Hello Kavya. We have reviewed your inquiry and authorized the escrow bank reconciliation.',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.authorRole).toBe('STAFF');
    expect(body.isInternal).toBe(false);
  });

  // ==============================================================================
  // 5. Staff Internal Notes & Security Isolation
  // ==============================================================================

  it('allows staff to add internal note that is hidden from customer (201)', async () => {
    // 1. Staff adds internal note
    const noteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${testTicketId}/notes`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        body: 'INTERNAL NOTE: Verified bank webhook ledger reference #TXN-90214-IN with payments gateway.',
      },
    });
    expect(noteRes.statusCode).toBe(201);
    const noteBody = JSON.parse(noteRes.body);
    expect(noteBody.isInternal).toBe(true);

    // 2. Staff views messages -> internal note IS present
    const staffMessagesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${staffToken}` },
    });
    const staffMessages = JSON.parse(staffMessagesRes.body);
    expect(staffMessages.items.some((m: any) => m.isInternal === true)).toBe(true);

    // 3. Customer views messages -> internal note is STRICTLY EXCLUDED
    const customerMessagesRes = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });
    const customerMessages = JSON.parse(customerMessagesRes.body);
    expect(customerMessages.items.some((m: any) => m.isInternal === true)).toBe(false);
    expect(customerMessages.items.every((m: any) => !m.body.includes('INTERNAL NOTE:'))).toBe(true);
  });

  // ==============================================================================
  // 6. Concurrency, Optimistic Locking & Status Lifecycle
  // ==============================================================================

  it('rejects stale status transition with 409 Conflict when expectedVersion mismatch occurs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${testTicketId}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        status: 'WAITING_FOR_CUSTOMER',
        expectedVersion: 1, // Stale version! (Current version is at least 2)
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('SUPPORT_TICKET_CONFLICT');
  });

  it('allows customer to mark ticket as resolved (200)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${testTicketId}/resolve`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('RESOLVED');
    expect(body.resolvedAt).not.toBeNull();

    // Verify outbox event
    const outbox = await prisma.outboxEvent.findFirst({
      where: { aggregateId: testTicketId, eventType: 'support.ticket.resolved.v1' },
    });
    expect(outbox).not.toBeNull();
  });

  it('allows customer to reopen a resolved ticket (200)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${testTicketId}/reopen`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('IN_PROGRESS');
  });

  it('allows staff to close ticket and verifies customer cannot reply to closed ticket', async () => {
    // 1. Staff closes ticket
    const closeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${testTicketId}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        status: 'CLOSED',
        resolutionSummary: 'Escrow release confirmed into bank batch window. Inquiry closed.',
      },
    });
    expect(closeRes.statusCode).toBe(200);
    const closeBody = JSON.parse(closeRes.body);
    expect(closeBody.status).toBe('CLOSED');
    expect(closeBody.closedAt).not.toBeNull();

    // 2. Customer tries to reply -> Rejected with 400
    const replyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${testTicketId}/messages`,
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: {
        body: 'Attempt to message a closed ticket.',
      },
    });
    expect(replyRes.statusCode).toBe(400);
    const replyBody = JSON.parse(replyRes.body);
    expect(replyBody.code).toBe('SUPPORT_TICKET_CLOSED');
  });

  // ==============================================================================
  // 7. Concurrency Race Conditions & State Machine Invariants
  // ==============================================================================

  it('handles true concurrent status transitions where only one succeeds and the other receives 409 Conflict', async () => {
    // 1. Create a fresh ticket for racing
    const freshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/support/tickets',
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: {
        category: 'ESCROW_RECONCILIATION',
        priority: 'NORMAL',
        subject: 'Concurrency Race Test Ticket',
        description: 'Testing atomic row locking and conditional update.',
      },
    });
    expect(freshRes.statusCode).toBe(201);
    const freshTicket = JSON.parse(freshRes.body);
    const ticketId = freshTicket.id;
    expect(freshTicket.version).toBe(1);

    // 2. Fire two concurrent status update requests with the exact same expectedVersion (1)
    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/staff/support/tickets/${ticketId}/status`,
        headers: { authorization: `Bearer ${staffToken}` },
        payload: {
          status: 'IN_PROGRESS',
          expectedVersion: 1,
        },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/staff/support/tickets/${ticketId}/status`,
        headers: { authorization: `Bearer ${staffToken}` },
        payload: {
          status: 'WAITING_FOR_CUSTOMER',
          expectedVersion: 1,
        },
      }),
    ]);

    const statuses = [res1.statusCode, res2.statusCode];
    // Exactly one must succeed (200) and exactly one must fail with conflict (409)
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const conflictBody = JSON.parse(res1.statusCode === 409 ? res1.body : res2.body);
    expect(conflictBody.code).toBe('SUPPORT_TICKET_CONFLICT');
  });

  it('rejects customer attempts to reopen a closed ticket with 400 SupportTicketClosedError', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${testTicketId}/reopen`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.code).toBe('SUPPORT_TICKET_CLOSED');
  });

  it('confirms dual audit logging: platform AuditLog and SupportTicketAudit records commit atomically for all operations', async () => {
    // Check that platform-wide audit log recorded operations for testTicketId
    const platformAudits = await prisma.auditLog.findMany({
      where: { entityId: testTicketId },
      orderBy: { createdAt: 'asc' },
    });
    expect(platformAudits.length).toBeGreaterThanOrEqual(2);
    const actions = platformAudits.map((a) => a.action);
    expect(actions).toContain('SUPPORT_TICKET_CREATED');
    expect(actions).toContain('SUPPORT_TICKET_CLOSED');

    // Check that domain-specific SupportTicketAudit records exist
    const domainAudits = await prisma.supportTicketAudit.findMany({
      where: { ticketId: testTicketId },
      orderBy: { createdAt: 'asc' },
    });
    expect(domainAudits.length).toBeGreaterThanOrEqual(2);
    const domainActions = domainAudits.map((a) => a.action);
    expect(domainActions).toContain('CREATED');
    expect(domainActions).toContain('CLOSED');
  });

  // ==============================================================================
  // 8. Staging Rehearsal: Keyset Pagination, Reassignment & Outbox Safety
  // ==============================================================================

  it('verifies keyset cursor pagination across ticket conversation history', async () => {
    // 1. Create ticket with multiple messages
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/v1/support/tickets',
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: {
        category: 'CONTRACT_VALIDATION',
        priority: 'NORMAL',
        subject: 'Pagination Staging Rehearsal',
        description: 'First initial message.',
      },
    });
    const ticket = JSON.parse(ticketRes.body);

    // Add 3 more messages
    await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${ticket.id}/messages`,
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: { body: 'Second message in thread.' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${ticket.id}/messages`,
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: { body: 'Third message in thread.' },
    });

    // 2. Query Page 1 with limit 2
    const page1Res = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${ticket.id}/messages?limit=2`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });
    expect(page1Res.statusCode).toBe(200);
    const page1 = JSON.parse(page1Res.body);
    expect(page1.items.length).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    // 3. Query Page 2 with cursor
    const page2Res = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${ticket.id}/messages?limit=2&cursor=${page1.nextCursor}`,
      headers: { authorization: `Bearer ${customerAToken}` },
    });
    expect(page2Res.statusCode).toBe(200);
    const page2 = JSON.parse(page2Res.body);
    expect(page2.items.length).toBe(1);
    expect(page2.hasMore).toBe(false);
  });

  it('verifies customer reply auto-transitions WAITING_FOR_CUSTOMER ticket to IN_PROGRESS', async () => {
    // 1. Create ticket
    const ticketRes = await app.inject({
      method: 'POST',
      url: '/api/v1/support/tickets',
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: {
        category: 'ACCOUNT_ACCESS',
        priority: 'HIGH',
        subject: 'Auto-transition Staging Test',
        description: 'Needs specialist triage.',
      },
    });
    const ticket = JSON.parse(ticketRes.body);

    // 2. Staff sets status to WAITING_FOR_CUSTOMER
    await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${ticket.id}/status`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: { status: 'WAITING_FOR_CUSTOMER', expectedVersion: 1 },
    });

    // 3. Customer posts reply
    const replyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/support/tickets/${ticket.id}/messages`,
      headers: { authorization: `Bearer ${customerAToken}` },
      payload: { body: 'Providing requested bank transaction verification.' },
    });
    expect(replyRes.statusCode).toBe(201);

    // 4. Verify ticket auto-transitioned to IN_PROGRESS
    const updatedTicket = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
    expect(updatedTicket?.status).toBe('IN_PROGRESS');

    // 5. Verify status change audit entry was generated
    const statusAudit = await prisma.supportTicketAudit.findFirst({
      where: {
        ticketId: ticket.id,
        action: 'STATUS_CHANGED',
        fromStatus: 'WAITING_FOR_CUSTOMER',
        toStatus: 'IN_PROGRESS',
      },
    });
    expect(statusAudit).not.toBeNull();
  });

  it('guarantees internal note outbox events classify isInternal=true to shield customer delivery channels', async () => {
    const noteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/staff/support/tickets/${testTicketId}/notes`,
      headers: { authorization: `Bearer ${staffToken}` },
      payload: {
        body: 'CONFIDENTIAL AUDIT NOTE: Risk assessment complete.',
      },
    });
    expect(noteRes.statusCode).toBe(201);

    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: testTicketId,
        eventType: 'support.ticket.internal_note.created.v1',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).not.toBeNull();
    const payload = outbox?.payload as any;
    expect(payload.isInternal).toBe(true);
    expect(payload.authorRole).toBe('STAFF');
  });
});
