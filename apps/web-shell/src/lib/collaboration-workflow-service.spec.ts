import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CollaborationWorkflowService } from './collaboration-workflow-service.js';

describe('CollaborationWorkflowService (Phase 11)', () => {
  let service: CollaborationWorkflowService;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    service = new CollaborationWorkflowService('http://test-api:3001');
  });

  describe('Saved Creators', () => {
    it('calls POST /api/v1/saved-creators to save creator', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'save-1', clientId: 'c-1', creatorId: 'cr-1' }),
      });

      const res = await service.saveCreator('cr-1', 'test-token');
      expect(res.id).toBe('save-1');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3001/api/v1/saved-creators',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({ creatorId: 'cr-1' }),
        }),
      );
    });

    it('calls DELETE /api/v1/saved-creators/:id to unsave', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await service.unsaveCreator('cr-1', 'test-token');
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3001/api/v1/saved-creators/cr-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('calls GET /api/v1/saved-creators/check/:id to check saved status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ isSaved: true }),
      });

      const isSaved = await service.checkSavedStatus('cr-1', 'test-token');
      expect(isSaved).toBe(true);
    });
  });

  describe('Shortlists', () => {
    it('calls POST /api/v1/shortlists to create shortlist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'sl-1', name: 'Q4 Talent', memberCount: 0 }),
      });

      const res = await service.createShortlist({ name: 'Q4 Talent' }, 'test-token');
      expect(res.id).toBe('sl-1');
      expect(res.name).toBe('Q4 Talent');
    });

    it('calls GET /api/v1/shortlists to list shortlists', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [{ id: 'sl-1', name: 'Q4 Talent' }], total: 1 }),
      });

      const res = await service.listShortlists('test-token');
      expect(res.items.length).toBe(1);
    });

    it('calls POST /api/v1/shortlists/:id/members to add creator', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'm-1', shortlistId: 'sl-1', creatorId: 'cr-1' }),
      });

      const res = await service.addShortlistMember(
        'sl-1',
        { creatorId: 'cr-1', note: 'Top pick' },
        'test-token',
      );
      expect(res.id).toBe('m-1');
    });

    it('calls DELETE /api/v1/shortlists/:id/members/:creatorId to remove creator', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await service.removeShortlistMember('sl-1', 'cr-1', 'test-token');
      expect(res.success).toBe(true);
    });
  });

  describe('Invitations', () => {
    it('calls POST /api/v1/invitations to create invitation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'inv-1', status: 'PENDING', message: 'Hello' }),
      });

      const res = await service.createInvitation(
        { projectId: 'p-1', creatorId: 'cr-1', message: 'Hello' },
        'test-token',
      );
      expect(res.id).toBe('inv-1');
      expect(res.status).toBe('PENDING');
    });

    it('calls POST /api/v1/invitations/:id/accept to accept invitation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await service.acceptInvitation('inv-1', 'test-token');
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3001/api/v1/invitations/inv-1/accept',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('calls POST /api/v1/invitations/:id/withdraw to withdraw invitation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await service.withdrawInvitation('inv-1', 'test-token');
      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api:3001/api/v1/invitations/inv-1/withdraw',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
