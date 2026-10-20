import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AssignmentsWorkflowService,
  formatMinorUnitsToCurrency,
  getAssignmentStatusBadgeVariant,
  getApplicationStatusBadgeVariant,
} from './assignments-workflow-service';

describe('AssignmentsWorkflowService', () => {
  let service: AssignmentsWorkflowService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new AssignmentsWorkflowService('http://mock-api.local');
  });

  describe('searchAssignments', () => {
    it('constructs correct query parameters and returns search results', async () => {
      const mockResult = {
        items: [{ id: 'asn-1', title: 'Video Editor Needed' }],
        nextCursor: null,
        hasMore: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      });

      const res = await service.searchAssignments({
        q: 'director',
        budgetMin: 5000000,
        budgetMax: 10000000,
        isRemote: true,
        limit: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.local/api/v1/discovery/assignments?q=director&budgetMin=5000000&budgetMax=10000000&isRemote=true&limit=10',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        }),
      );
      expect(res.items).toHaveLength(1);
      expect(res.items[0]!.id).toBe('asn-1');
    });

    it('attaches bearer auth token if provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], nextCursor: null, hasMore: false }),
      });

      await service.searchAssignments({}, 'test-token-jwt');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.local/api/v1/discovery/assignments',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-jwt',
          }),
        }),
      );
    });

    it('throws error when server responds with 400/500', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: 'Invalid query cursor' }),
      });

      await expect(service.searchAssignments({ cursor: 'invalid' })).rejects.toThrow(
        'Invalid query cursor',
      );
    });
  });

  describe('getAssignment', () => {
    it('fetches single assignment by ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'asn-123', title: 'Docuseries Director' }),
      });

      const result = await service.getAssignment('asn-123');
      expect(result.id).toBe('asn-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.local/api/v1/assignments/asn-123',
        expect.anything(),
      );
    });
  });

  describe('createAssignment & publishAssignment', () => {
    it('sends POST to create assignment and returns response', async () => {
      const payload: any = {
        title: 'Documentary Sound Designer',
        description: 'Sound engineering needed',
        budgetMin: 500000,
        budgetMax: 1000000,
        deadline: '2026-12-01T00:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-asn-1', ...payload, status: 'DRAFT' }),
      });

      const res = await service.createAssignment(payload, 'token-123');
      expect(res.id).toBe('new-asn-1');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.local/api/v1/assignments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('publishes assignment with version check', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'new-asn-1', status: 'PUBLISHED', version: 2 }),
      });

      const res = await service.publishAssignment('new-asn-1', 1, 'token-123');
      expect(res.status).toBe('PUBLISHED');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://mock-api.local/api/v1/assignments/new-asn-1/publish',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ version: 1 }),
        }),
      );
    });
  });

  describe('Presentation Helpers', () => {
    it('formats paise correctly into INR currency', () => {
      expect(formatMinorUnitsToCurrency(15000000, 'INR')).toBe('₹1,50,000');
      expect(formatMinorUnitsToCurrency(500000, 'INR')).toBe('₹5,000');
    });

    it('returns valid status badges for assignment statuses', () => {
      expect(getAssignmentStatusBadgeVariant('PUBLISHED').label).toBe('Active & Open');
      expect(getAssignmentStatusBadgeVariant('DRAFT').label).toBe('Draft');
      expect(getAssignmentStatusBadgeVariant('COMPLETED').label).toBe('Completed');
    });

    it('returns valid badge variants for application statuses', () => {
      expect(getApplicationStatusBadgeVariant('ACCEPTED').label).toBe('Hired & Active');
      expect(getApplicationStatusBadgeVariant('SHORTLISTED').label).toBe('Shortlisted');
      expect(getApplicationStatusBadgeVariant('SUBMITTED').label).toBe('Under Review');
    });
  });
});
