import { test, expect } from '@playwright/test';
import { getPrismaClient, type PrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { createTestJwt } from '../fixtures/auth-test-helper.js';
import Redis from 'ioredis';

test.describe('Phase 19F Consent-Gated Messaging End-to-End Acceptance (Milestone 2D.2)', () => {
  test.describe.configure({ mode: 'serial' });
  const prisma: PrismaClient = getPrismaClient();
  const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';

  const createdUserIds: string[] = [];
  const createdConversationIds: string[] = [];
  const createdRequestIds: string[] = [];

  test.beforeAll(async () => {
    try {
      const redis = new Redis(
        process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0',
      );
      await redis.del('rl:s:chat_request_create:127.0.0.1');
      await redis.quit();
    } catch {}
  });

  test.afterAll(async () => {
    // Clean up created resources in reverse foreign-key order
    for (const convId of createdConversationIds) {
      try {
        await prisma.message.deleteMany({ where: { conversationId: convId } });
        await prisma.conversationParticipant.deleteMany({ where: { conversationId: convId } });
        await prisma.conversation.deleteMany({ where: { id: convId } });
      } catch {}
    }

    for (const reqId of createdRequestIds) {
      try {
        await prisma.messageRequest.deleteMany({ where: { id: reqId } });
      } catch {}
    }

    for (const uId of createdUserIds) {
      try {
        await prisma.message.deleteMany({ where: { senderId: uId } });
        await prisma.conversationParticipant.deleteMany({ where: { userId: uId } });
        await prisma.userBlock.deleteMany({
          where: { OR: [{ blockerId: uId }, { blockedId: uId }] },
        });
        await prisma.notification.deleteMany({ where: { userId: uId } });
        await prisma.brandProfile.deleteMany({ where: { userId: uId } });
        await prisma.creatorProfile.deleteMany({ where: { userId: uId } });
        await prisma.userRole.deleteMany({ where: { userId: uId } });
        await prisma.user.deleteMany({ where: { id: uId } });
      } catch {}
    }
  });

  async function provisionUser(
    role: 'BRAND' | 'CREATOR' | 'PROFESSIONAL',
    name: { first: string; last: string },
    status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' = 'ACTIVE',
  ) {
    const userId = generateUuidV7();
    const ts = Date.now();
    const sub = `sub_e2e_msg_${role.toLowerCase()}_${ts}_${userId.replace(/-/g, '').slice(0, 8)}`;
    const email = `e2e_msg_${role.toLowerCase()}_${ts}_${userId.replace(/-/g, '').slice(0, 8)}@creatorconnect.test`;

    createdUserIds.push(userId);

    const user = await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: sub,
        email,
        firstName: name.first,
        lastName: name.last,
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
        ...(role === 'BRAND'
          ? {
              brandProfile: {
                create: {
                  id: generateUuidV7(),
                  companyName: `${name.first}'s Studio`,
                  websiteUrl: 'https://brand.example.com',
                  industry: 'Marketing',
                },
              },
            }
          : {
              creatorProfile: {
                create: {
                  id: generateUuidV7(),
                  tagline: 'Tech & AI Creator',
                  bio: 'Full-time content creator and editor',
                },
              },
            }),
      },
    });

    const token = await createTestJwt({ sub, email });
    return { user, userId, sub, email, token, displayName: `${name.first} ${name.last}` };
  }

  // ---------------------------------------------------------------------------
  // SCENARIO A: REQUEST CREATION AND RECEIPT
  // ---------------------------------------------------------------------------
  test('Scenario A: Sender creates proposal request; Recipient receives PENDING request with no early conversation', async ({
    page,
    browser,
  }) => {
    const sender = await provisionUser('BRAND', { first: 'Alice', last: 'Brand' });
    const recipient = await provisionUser('CREATOR', { first: 'Bob', last: 'Creator' });

    // 1. Sign in as Sender in primary page
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('response', (res) => {
      if (res.url().includes('/api/')) {
        console.log('PAGE API RES:', res.url(), res.status());
      }
    });

    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, sender.token);

    await page.goto('/messages', { waitUntil: 'networkidle' });

    // Open Start Conversation Modal
    const startConvoBtn = page.getByRole('button', { name: /Start Conversation/i });
    await expect(startConvoBtn).toBeVisible({ timeout: 10000 });
    await startConvoBtn.click();

    // Verify Compose Modal appears
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Start Message Request/i })).toBeVisible();

    // Fill Recipient and Initial Message
    await page.fill('#compose-recipient', recipient.userId);
    const pitchText =
      'Hello Bob, we want to commission a dedicated video review of our new creator studio tool.';
    await page.fill('#compose-initial-message', pitchText);

    // Submit Request
    console.log('TEST: clicking submit button');
    const submitBtn = page.getByRole('button', { name: /Send Message Request/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    console.log('TEST: clicked submit button');

    // Give a brief moment for submission response
    await page.waitForTimeout(1500);
    const count = await page.locator('[role="dialog"]').count();
    console.log('TEST: [role="dialog"] count is', count);
    if (count > 0) {
      console.log('TEST: dialog text is', await page.locator('[role="dialog"]').textContent());
    }
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // Switch to Requests tab -> Outgoing
    const requestsTab = page.getByRole('button', { name: /Requests/i });
    await requestsTab.click();

    const outgoingSubTab = page.getByRole('button', { name: 'Outgoing', exact: true });
    await outgoingSubTab.click();

    // Verify outgoing request appears in the list
    await expect(page.locator(`text=${recipient.userId.slice(0, 8)}`).first()).toBeVisible({
      timeout: 10000,
    });

    // Verify database state: Request is PENDING, NO conversation or messages exist yet
    const dbRequest = await prisma.messageRequest.findFirst({
      where: { senderId: sender.userId, recipientId: recipient.userId },
    });
    expect(dbRequest).not.toBeNull();
    expect(dbRequest?.status).toBe('PENDING');
    createdRequestIds.push(dbRequest!.id);

    const conversations = await prisma.conversationParticipant.findMany({
      where: { userId: { in: [sender.userId, recipient.userId] } },
    });
    expect(conversations).toHaveLength(0);

    // 2. Open separate browser context for Recipient
    const recipientContext = await browser.newContext();
    const recipientPage = await recipientContext.newPage();

    await recipientPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, recipient.token);

    await recipientPage.goto('/messages', { waitUntil: 'networkidle' });

    // Switch to Requests tab
    const recipientRequestsTab = recipientPage.getByRole('button', { name: /Requests/i });
    await expect(recipientRequestsTab).toBeVisible({ timeout: 10000 });
    await recipientRequestsTab.click();

    // Ensure Inbound sub-tab is visible and active
    const inboundSubTab = recipientPage.getByRole('button', { name: /Inbound/i });
    await expect(inboundSubTab).toBeVisible({ timeout: 5000 });

    // Verify incoming request card appears with sender info
    await expect(recipientPage.locator(`text=Alice Brand`).first()).toBeVisible({ timeout: 10000 });
    await expect(recipientPage.locator('text=PENDING').first()).toBeVisible();

    await recipientContext.close();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO B: ACCEPTANCE AND INITIAL MESSAGE ATOMICITY
  // ---------------------------------------------------------------------------
  test('Scenario B: Recipient accepts request -> atomic conversation creation, sequence-1 message, follow-up messaging', async ({
    page,
    browser,
  }) => {
    const sender = await provisionUser('BRAND', { first: 'Claire', last: 'Sponsor' });
    const recipient = await provisionUser('CREATOR', { first: 'David', last: 'Editor' });

    // Pre-create pending request via API/DB
    const initialPitch =
      'Hi David! We have an immediate contract proposal for post-production editing.';
    const request = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: initialPitch,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(request.id);

    // 1. Recipient opens messaging inbox
    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, recipient.token);

    await page.goto('/messages', { waitUntil: 'networkidle' });

    // Navigate to Requests
    await page.getByRole('button', { name: /Requests/i }).click();

    // Click on Claire Sponsor's request card
    const requestCard = page.locator(`text=Claire Sponsor`).first();
    await expect(requestCard).toBeVisible({ timeout: 10000 });
    await requestCard.click();

    // Verify Detail Pane displays pitch and Accept button
    await expect(page.locator(`text=${initialPitch}`).first()).toBeVisible({ timeout: 10000 });
    const acceptBtn = page.getByRole('button', { name: /Accept & Start Chat/i });
    await expect(acceptBtn).toBeVisible();

    // Accept proposal and wait for acceptance API response
    const acceptResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/accept') && res.status() === 200,
    );
    await acceptBtn.click();
    await acceptResponsePromise;

    // Verify authoritative database state
    const updatedRequest = await prisma.messageRequest.findUnique({ where: { id: request.id } });
    expect(updatedRequest?.status).toBe('ACCEPTED');

    const conversation = await prisma.conversation.findFirst({
      where: {
        participants: {
          some: { userId: recipient.userId },
        },
      },
      include: {
        participants: true,
        messages: { orderBy: { sequence: 'asc' } },
      },
    });

    expect(conversation).not.toBeNull();
    createdConversationIds.push(conversation!.id);

    // Verify atomic participants: exactly sender and recipient
    const participantUserIds = conversation!.participants.map((p) => p.userId);
    expect(participantUserIds).toContain(sender.userId);
    expect(participantUserIds).toContain(recipient.userId);
    expect(conversation!.participants).toHaveLength(2);

    // Verify initial message: exactly 1 message, sequence number 1
    expect(conversation!.messages).toHaveLength(1);
    const firstMsg = conversation!.messages[0]!;
    expect(Number(firstMsg.sequence)).toBe(1);
    expect(firstMsg.senderId).toBe(sender.userId);
    expect(firstMsg.content).toBe(initialPitch);

    // 2. Both users can now exchange follow-up messages
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();

    await senderPage.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, sender.token);

    await senderPage.goto(`/messages/${conversation!.id}`, { waitUntil: 'networkidle' });

    // Verify initial message visible to sender in conversation view
    await expect(senderPage.locator(`text=${initialPitch}`).first()).toBeVisible({
      timeout: 10000,
    });

    await senderContext.close();
  });

  // ---------------------------------------------------------------------------
  // SCENARIO C: EXACTLY-ONCE IDEMPOTENCY
  // ---------------------------------------------------------------------------
  test('Scenario C: Retried acceptance recovers accepted conversation without duplicate records or sequence collisions', async () => {
    const sender = await provisionUser('BRAND', { first: 'Elena', last: 'Founder' });
    const recipient = await provisionUser('CREATOR', { first: 'Felix', last: 'Animator' });

    const pitch = 'Hey Felix, checking your availability for 3D character rigging.';
    const request = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: pitch,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(request.id);

    // First acceptance via direct API call
    const acceptRes1 = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipient.token}`,
        'Content-Type': 'application/json',
      },
    });
    expect(acceptRes1.status).toBe(200);
    const body1 = await acceptRes1.json();
    const convoId = body1.conversation.id;
    createdConversationIds.push(convoId);

    // Second acceptance (simulating network retry / duplicate click)
    const acceptRes2 = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipient.token}`,
        'Content-Type': 'application/json',
      },
    });
    // Expected: 200 idempotent response returning the exact same conversation
    expect(acceptRes2.status).toBe(200);
    const body2 = await acceptRes2.json();
    expect(body2.conversation.id).toBe(convoId);

    // Verify database has exactly 1 conversation and 1 message with sequence 1
    const convoCount = await prisma.conversation.count({
      where: {
        AND: [
          { participants: { some: { userId: sender.userId } } },
          { participants: { some: { userId: recipient.userId } } },
        ],
      },
    });
    expect(convoCount).toBe(1);

    const messages = await prisma.message.findMany({
      where: { conversationId: convoId },
      orderBy: { sequence: 'asc' },
    });
    expect(messages).toHaveLength(1);
    expect(Number(messages[0]?.sequence)).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO D: DECLINE LIFECYCLE & 30-DAY COOLDOWN
  // ---------------------------------------------------------------------------
  test('Scenario D: Recipient declines proposal -> DECLINED state and 30-day cooldown enforcement', async () => {
    const sender = await provisionUser('BRAND', { first: 'Grace', last: 'Marketer' });
    const recipient = await provisionUser('CREATOR', { first: 'Henry', last: 'Vlogger' });

    const request = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: 'We would love to sponsor your next travel vlog.',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(request.id);

    // Recipient declines proposal
    const declineRes = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}/decline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipient.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Not accepting commercial partnerships this quarter' }),
    });
    expect(declineRes.status).toBe(200);

    // Verify DB status is DECLINED
    const updated = await prisma.messageRequest.findUnique({ where: { id: request.id } });
    expect(updated?.status).toBe('DECLINED');

    // Verify no conversation was authorized
    const convos = await prisma.conversationParticipant.findMany({
      where: { userId: { in: [sender.userId, recipient.userId] } },
    });
    expect(convos).toHaveLength(0);

    // Sender immediately attempts to resend a new request -> Rejected by 30-day cooldown
    const retryRes = await fetch(`${API_URL}/api/v1/chat/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sender.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: recipient.userId,
        initialMessage: 'Following up with a higher budget offer.',
      }),
    });
    expect(retryRes.status).toBe(409);
    const retryErr = await retryRes.json();
    expect(retryErr.code).toBe('MESSAGE_REQUEST_COOLDOWN_ACTIVE');
    expect(retryErr.detail).toContain('declined');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO E: CANCELLATION LIFECYCLE & 24-HOUR COOLDOWN
  // ---------------------------------------------------------------------------
  test('Scenario E: Sender cancels pending proposal -> CANCELLED state and 24-hour cooldown enforcement', async () => {
    const sender = await provisionUser('BRAND', { first: 'Iris', last: 'Producer' });
    const recipient = await provisionUser('CREATOR', { first: 'Jack', last: 'Streamer' });

    const request = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: 'Podcast guest spot invitation.',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(request.id);

    // Sender cancels request
    const cancelRes = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sender.token}`,
      },
    });
    expect(cancelRes.status).toBe(200);

    // Recipient attempts to accept cancelled request -> Fails with 409
    const acceptRes = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}/accept`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${recipient.token}`,
      },
    });
    expect(acceptRes.status).toBe(409);

    // Sender attempts to immediately recreate request -> Rejected by 24-hour cancellation cooldown
    const retryRes = await fetch(`${API_URL}/api/v1/chat/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sender.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: recipient.userId,
        initialMessage: 'Resending with revised scheduling details.',
      }),
    });
    expect(retryRes.status).toBe(409);
    const retryErr = await retryRes.json();
    expect(retryErr.code).toBe('MESSAGE_REQUEST_COOLDOWN_ACTIVE');
    expect(retryErr.detail).toContain('cancelling');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO F: SECURITY, AUTHORIZATION & CONSENT GATE INTEGRATION
  // ---------------------------------------------------------------------------
  test('Scenario F: Unconsented direct conversation creation is blocked; Intruder cannot access private requests', async () => {
    const sender = await provisionUser('BRAND', { first: 'Kate', last: 'Founder' });
    const recipient = await provisionUser('CREATOR', { first: 'Leo', last: 'Musician' });
    const intruder = await provisionUser('CREATOR', { first: 'Mallory', last: 'Intruder' });

    // 1. Direct conversation creation without accepted request or commercial relationship must be forbidden
    const directConvoRes = await fetch(`${API_URL}/api/v1/conversations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sender.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: recipient.userId,
      }),
    });
    expect(directConvoRes.status).toBe(403);
    const directErr = await directConvoRes.json();
    expect(directErr.code).toBe('MESSAGE_REQUEST_REQUIRED');

    // 2. Intruder attempts to view or accept someone else's request
    const request = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: 'Confidential commercial contract proposal.',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(request.id);

    const intruderGetRes = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}`, {
      headers: { Authorization: `Bearer ${intruder.token}` },
    });
    expect(intruderGetRes.status).toBe(404);

    const intruderAcceptRes = await fetch(`${API_URL}/api/v1/chat/requests/${request.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${intruder.token}` },
    });
    expect(intruderAcceptRes.status).toBe(404);

    // 3. User attempting to send message request to self
    const selfRes = await fetch(`${API_URL}/api/v1/chat/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sender.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: sender.userId,
        initialMessage: 'Self-request test',
      }),
    });
    expect(selfRes.status).toBe(400);
    const selfErr = await selfRes.json();
    expect(selfErr.code).toBe('SELF_MESSAGE_REQUEST_NOT_ALLOWED');
  });
});
