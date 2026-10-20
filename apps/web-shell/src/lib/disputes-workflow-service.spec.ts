import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  canOpenDispute,
  canRequestCancellation,
  canDecideCancellation,
  canWithdrawCancellation,
  canResolveDispute,
  canAddEvidence,
  validateOpenDispute,
  validateAddEvidence,
  validateCancellationRequest,
  validateResolveDispute,
  parseApiError,
  openDispute,
  listDisputes,
  getDispute,
  addDisputeEvidence,
  updateDisputeStatus,
  resolveDispute,
  closeDispute,
  requestCancellation,
  listCancellations,
  decideCancellation,
  withdrawCancellation,
  fetchPaymentRefunds,
} from './disputes-workflow-service';
import type { ProjectCancellationResponse } from '@creatorconnect/contracts';

describe('Phase 8: Disputes, Cancellations & Refund Workflow Service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Role-Based Invariants and State Guards', () => {
    it('enforces canOpenDispute invariants', () => {
      // Allowed for client/creator when project is active and not already disputed
      expect(canOpenDispute('IN_PROGRESS', 'client', false)).toBe(true);
      expect(canOpenDispute('IN_PROGRESS', 'creator', false)).toBe(true);
      expect(canOpenDispute('IN_PROGRESS', 'admin', false)).toBe(true);

      // Denied for viewers
      expect(canOpenDispute('IN_PROGRESS', 'viewer', false)).toBe(false);

      // Denied when project is already CANCELLED
      expect(canOpenDispute('CANCELLED', 'client', false)).toBe(false);

      // Denied when an active dispute is already open
      expect(canOpenDispute('IN_PROGRESS', 'client', true)).toBe(false);
    });

    it('enforces canRequestCancellation invariants', () => {
      // Allowed when active, no pending cancellation, no active dispute
      expect(canRequestCancellation('IN_PROGRESS', 'client', false, false)).toBe(true);
      expect(canRequestCancellation('IN_PROGRESS', 'creator', false, false)).toBe(true);
      expect(canRequestCancellation('IN_PROGRESS', 'admin', false, false)).toBe(true);

      // Denied for viewers
      expect(canRequestCancellation('IN_PROGRESS', 'viewer', false, false)).toBe(false);

      // Denied if already CANCELLED or COMPLETED
      expect(canRequestCancellation('CANCELLED', 'client', false, false)).toBe(false);
      expect(canRequestCancellation('COMPLETED', 'creator', false, false)).toBe(false);

      // Denied if pending cancellation exists
      expect(canRequestCancellation('IN_PROGRESS', 'client', true, false)).toBe(false);

      // Denied if active dispute exists
      expect(canRequestCancellation('IN_PROGRESS', 'client', false, true)).toBe(false);
    });

    it('enforces mutual consent on canDecideCancellation', () => {
      const mockCancellation: ProjectCancellationResponse = {
        id: 'c1',
        projectId: 'p1',
        requestedById: 'user-client-1',
        reason: 'Project requirements changed drastically',
        status: 'PENDING',
        decidedById: null,
        decisionReason: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Requester CANNOT decide their own request
      expect(canDecideCancellation(mockCancellation, 'user-client-1', false)).toBe(false);

      // Counterparty CAN decide
      expect(canDecideCancellation(mockCancellation, 'user-creator-2', false)).toBe(true);

      // Admin CAN decide regardless of who requested
      expect(canDecideCancellation(mockCancellation, 'user-client-1', true)).toBe(true);

      // If status is not PENDING, decision is locked
      const decidedCancellation = { ...mockCancellation, status: 'APPROVED' as const };
      expect(canDecideCancellation(decidedCancellation, 'user-creator-2', false)).toBe(false);
    });

    it('enforces canWithdrawCancellation invariants', () => {
      const mockCancellation: ProjectCancellationResponse = {
        id: 'c1',
        projectId: 'p1',
        requestedById: 'user-creator-1',
        reason: 'Requested by mistake',
        status: 'PENDING',
        decidedById: null,
        decisionReason: null,
        decidedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Requester CAN withdraw
      expect(canWithdrawCancellation(mockCancellation, 'user-creator-1', false)).toBe(true);

      // Counterparty CANNOT withdraw
      expect(canWithdrawCancellation(mockCancellation, 'user-client-2', false)).toBe(false);

      // Admin CAN withdraw
      expect(canWithdrawCancellation(mockCancellation, 'user-client-2', true)).toBe(true);

      // Non-pending cannot be withdrawn
      const approved = { ...mockCancellation, status: 'APPROVED' as const };
      expect(canWithdrawCancellation(approved, 'user-creator-1', false)).toBe(false);
    });

    it('enforces admin-only arbitration on canResolveDispute', () => {
      expect(canResolveDispute('OPEN', true)).toBe(true);
      expect(canResolveDispute('UNDER_REVIEW', true)).toBe(true);
      expect(canResolveDispute('EVIDENCE_REQUESTED', true)).toBe(true);

      // Non-admins CANNOT resolve
      expect(canResolveDispute('OPEN', false)).toBe(false);
      expect(canResolveDispute('UNDER_REVIEW', false)).toBe(false);

      // Terminal dispute states cannot be re-resolved
      expect(canResolveDispute('RESOLVED_FOR_CLIENT', true)).toBe(false);
      expect(canResolveDispute('RESOLVED_FOR_CREATOR', true)).toBe(false);
      expect(canResolveDispute('CLOSED', true)).toBe(false);
    });

    it('enforces canAddEvidence invariants', () => {
      expect(canAddEvidence('OPEN', 'client')).toBe(true);
      expect(canAddEvidence('UNDER_REVIEW', 'creator')).toBe(true);
      expect(canAddEvidence('EVIDENCE_REQUESTED', 'admin')).toBe(true);

      // Viewers cannot add evidence
      expect(canAddEvidence('OPEN', 'viewer')).toBe(false);

      // Cannot add evidence once resolved or closed
      expect(canAddEvidence('RESOLVED_FOR_CLIENT', 'client')).toBe(false);
      expect(canAddEvidence('CLOSED', 'creator')).toBe(false);
    });
  });

  describe('Form and Input Validation', () => {
    it('validates open dispute form data', () => {
      // Valid input
      const valid = validateOpenDispute({
        reason: 'DELIVERABLE_POOR_QUALITY',
        description: 'The deliverable provided does not match the agreed contract brief.',
      });
      expect(valid.valid).toBe(true);
      expect(valid.errors).toHaveLength(0);

      // Missing reason
      const noReason = validateOpenDispute({
        description: 'Valid explanation text with sufficient characters.',
      });
      expect(noReason.valid).toBe(false);
      expect(noReason.errors).toContain('A valid dispute reason category is required.');

      // Too short description
      const shortDesc = validateOpenDispute({
        reason: 'MISSED_DEADLINE',
        description: 'Too short',
      });
      expect(shortDesc.valid).toBe(false);
      expect(shortDesc.errors).toContain(
        'Dispute explanation must be at least 10 characters long.',
      );
    });

    it('validates evidence submission', () => {
      const valid = validateAddEvidence({
        title: 'Screen recording of deliverable defects',
        description: 'Timecode 01:23 demonstrates regression.',
      });
      expect(valid.valid).toBe(true);

      const emptyTitle = validateAddEvidence({
        title: '   ',
      });
      expect(emptyTitle.valid).toBe(false);
      expect(emptyTitle.errors).toContain('Evidence title is required.');
    });

    it('validates cancellation request', () => {
      const valid = validateCancellationRequest({
        reason: 'Mutual agreement reached via platform chat.',
      });
      expect(valid.valid).toBe(true);

      const tooShort = validateCancellationRequest({
        reason: 'nope',
      });
      expect(tooShort.valid).toBe(false);
      expect(tooShort.errors).toContain('Cancellation reason must be at least 5 characters long.');
    });

    it('validates administrative dispute resolution', () => {
      const valid = validateResolveDispute({
        resolution: 'RESOLVED_FOR_CLIENT',
        resolutionReason: 'Milestone requirements were demonstrably not fulfilled.',
        refundAmount: 5000,
        escrowBalance: 10000,
      });
      expect(valid.valid).toBe(true);

      // Invalid resolution type
      const invalidType = validateResolveDispute({
        resolution: 'OTHER_CHOICE',
        resolutionReason: 'Arbitration notes here.',
      });
      expect(invalidType.valid).toBe(false);
      expect(invalidType.errors).toContain(
        'Resolution decision must be either RESOLVED_FOR_CLIENT or RESOLVED_FOR_CREATOR.',
      );

      // Refund exceeds escrow balance
      const excessRefund = validateResolveDispute({
        resolution: 'RESOLVED_FOR_CLIENT',
        resolutionReason: 'Valid reason here',
        refundAmount: 15000,
        escrowBalance: 10000,
      });
      expect(excessRefund.valid).toBe(false);
      expect(excessRefund.errors[0]).toContain('cannot exceed escrow balance');
    });
  });

  describe('API Transport Functions', () => {
    it('openDispute sends POST request with correct payload and headers', async () => {
      const mockResult = { id: 'disp-1', status: 'OPEN' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await openDispute(
        {
          projectId: 'proj-1',
          reason: 'SCOPE_MISMATCH',
          description: 'Scope has changed without formal agreement.',
        },
        'mock-token',
      );

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-token',
        },
        body: JSON.stringify({
          projectId: 'proj-1',
          reason: 'SCOPE_MISMATCH',
          description: 'Scope has changed without formal agreement.',
        }),
      });
      expect(res).toEqual(mockResult);
    });

    it('openDispute throws formatted error when API responds with 409 Conflict', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: 'An active dispute already exists for this project.' }),
      });

      await expect(
        openDispute(
          {
            projectId: 'proj-1',
            reason: 'SCOPE_MISMATCH',
            description: 'Scope has changed without formal agreement.',
          },
          'mock-token',
        ),
      ).rejects.toThrow('An active dispute already exists for this project.');
    });

    it('listDisputes formats query params properly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await listDisputes({ projectId: 'p-1', status: 'OPEN' }, 'token-123');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/disputes?projectId=p-1&status=OPEN',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-123' },
        }),
      );
    });

    it('requestCancellation sends POST request to project cancellation endpoint', async () => {
      const mockCancellation = { id: 'c-1', status: 'PENDING' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCancellation,
      });

      const res = await requestCancellation(
        'proj-99',
        { reason: 'Mutual agreement to cease work' },
        'token-abc',
      );

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/proj-99/cancellations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-abc',
        },
        body: JSON.stringify({ reason: 'Mutual agreement to cease work' }),
      });
      expect(res).toEqual(mockCancellation);
    });

    it('decideCancellation sends decision action', async () => {
      const mockResult = { id: 'c-1', status: 'APPROVED' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await decideCancellation(
        'proj-99',
        'c-1',
        { action: 'APPROVE', decisionReason: 'Agreed' },
        'token-xyz',
      );

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/projects/proj-99/cancellations/c-1/decide',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-xyz',
          },
          body: JSON.stringify({ action: 'APPROVE', decisionReason: 'Agreed' }),
        },
      );
      expect(res).toEqual(mockResult);
    });

    it('withdrawCancellation sends withdraw POST', async () => {
      const mockResult = { id: 'c-1', status: 'WITHDRAWN' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await withdrawCancellation('proj-99', 'c-1', 'token-xyz');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/projects/proj-99/cancellations/c-1/withdraw',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer token-xyz' },
        },
      );
      expect(res).toEqual(mockResult);
    });

    it('resolveDispute sends resolution POST', async () => {
      const mockResult = { id: 'd-1', status: 'RESOLVED_FOR_CLIENT' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await resolveDispute(
        'd-1',
        {
          resolution: 'RESOLVED_FOR_CLIENT',
          resolutionReason: 'Client fulfilled all obligations',
          refundAmount: 5000,
        },
        'admin-token',
      );

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/disputes/d-1/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-token',
        },
        body: JSON.stringify({
          resolution: 'RESOLVED_FOR_CLIENT',
          resolutionReason: 'Client fulfilled all obligations',
          refundAmount: 5000,
        }),
      });
      expect(res).toEqual(mockResult);
    });

    it('getDispute loads single dispute by ID', async () => {
      const mockDispute = { id: 'd-1', status: 'OPEN' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDispute,
      });

      const res = await getDispute('d-1', 'tok');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/disputes/d-1', {
        headers: { Authorization: 'Bearer tok' },
      });
      expect(res).toEqual(mockDispute);
    });

    it('addDisputeEvidence posts evidence payload to dispute', async () => {
      const mockEvidence = { id: 'ev-1', title: 'Proof of delivery' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockEvidence,
      });

      const res = await addDisputeEvidence(
        'd-1',
        { title: 'Proof of delivery', description: 'See link' },
        'tok',
      );
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/disputes/d-1/evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer tok',
        },
        body: JSON.stringify({ title: 'Proof of delivery', description: 'See link' }),
      });
      expect(res).toEqual(mockEvidence);
    });

    it('updateDisputeStatus sends status patch', async () => {
      const mockResult = { id: 'd-1', status: 'UNDER_REVIEW' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await updateDisputeStatus('d-1', { status: 'UNDER_REVIEW' }, 'admin-tok');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/disputes/d-1/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer admin-tok',
        },
        body: JSON.stringify({ status: 'UNDER_REVIEW' }),
      });
      expect(res).toEqual(mockResult);
    });

    it('closeDispute sends POST to close endpoint', async () => {
      const mockResult = { id: 'd-1', status: 'CLOSED' };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await closeDispute('d-1', 'admin-tok');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/disputes/d-1/close', {
        method: 'POST',
        headers: { Authorization: 'Bearer admin-tok' },
      });
      expect(res).toEqual(mockResult);
    });

    it('listCancellations queries project cancellations', async () => {
      const mockCancellations = [{ id: 'c-1', status: 'PENDING' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCancellations,
      });

      const res = await listCancellations('proj-123', 'tok');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/projects/proj-123/cancellations', {
        headers: { Authorization: 'Bearer tok' },
      });
      expect(res).toEqual(mockCancellations);
    });

    it('fetchPaymentRefunds queries the payment refunds endpoint', async () => {
      const mockRefunds = [{ id: 'ref-1', amount: 5000, status: 'SUCCEEDED' }];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRefunds,
      });

      const res = await fetchPaymentRefunds('pi-123', 'tok');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/payments/intents/pi-123/refunds', {
        headers: { Authorization: 'Bearer tok' },
      });
      expect(res).toEqual(mockRefunds);
    });
  });

  describe('parseApiError Fallbacks', () => {
    it('uses fallback message with HTTP status code when response is not JSON', async () => {
      const mockResponse = {
        status: 502,
        json: async () => {
          throw new Error('Not JSON');
        },
      } as unknown as Response;

      const message = await parseApiError(mockResponse, 'Gateway failure');
      expect(message).toBe('Gateway failure (HTTP 502)');
    });
  });
});
