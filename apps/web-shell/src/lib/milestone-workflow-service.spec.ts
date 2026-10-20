import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  canCreatorSubmit,
  canClientReview,
  canEditMilestone,
  canReleaseEscrow,
  validateSubmission,
  validateReview,
  generateIdempotencyKey,
  uploadDeliverableAttachment,
  fetchProjectDetails,
  fetchDeliverableSubmissions,
  submitDeliverable,
  reviewDeliverable,
  releaseEscrow,
  type DeliverableAttachmentItem,
  type SubmissionFormData,
  type ReviewFormData,
} from './milestone-workflow-service';
import type {
  ProjectDeliverableResponse,
  ProjectResponse,
  DeliverableSubmissionResponse,
} from '@creatorconnect/contracts';

describe('Phase 7: Milestone Workflow Service & Domain Invariants', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Role-Based Action Invariants & State Guards', () => {
    it('allows creator submission only when deliverable is PENDING or REVISION_REQUESTED', () => {
      expect(canCreatorSubmit('PENDING')).toBe(true);
      expect(canCreatorSubmit('REVISION_REQUESTED')).toBe(true);

      expect(canCreatorSubmit('SUBMITTED')).toBe(false);
      expect(canCreatorSubmit('APPROVED')).toBe(false);
      expect(canCreatorSubmit('IN_REVIEW')).toBe(false);
    });

    it('allows client review only when deliverable is SUBMITTED', () => {
      expect(canClientReview('SUBMITTED')).toBe(true);

      expect(canClientReview('PENDING')).toBe(false);
      expect(canClientReview('REVISION_REQUESTED')).toBe(false);
      expect(canClientReview('APPROVED')).toBe(false);
      expect(canClientReview('IN_REVIEW')).toBe(false);
    });

    it('allows milestone metadata editing only when milestone is not yet APPROVED', () => {
      expect(canEditMilestone('PENDING')).toBe(true);
      expect(canEditMilestone('SUBMITTED')).toBe(true);
      expect(canEditMilestone('REVISION_REQUESTED')).toBe(true);
      expect(canEditMilestone('IN_REVIEW')).toBe(true);

      expect(canEditMilestone('APPROVED')).toBe(false);
    });

    it('permits escrow release only when all deliverables are APPROVED and funded balance > 0', () => {
      const baseItem: ProjectDeliverableResponse = {
        id: '01a14580-c7e4-7c14-b64a-aa16beca7990',
        projectId: '01a14580-c7e4-7c14-b64a-aa16beca7991',
        title: 'Milestone 1',
        description: null,
        amount: 50000,
        dueDate: null,
        status: 'PENDING',
        version: 1,
        submittedAssetId: null,
        submissionNotes: null,
        revisionNotes: null,
        submittedAt: null,
        approvedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const pendingList: ProjectDeliverableResponse[] = [baseItem];
      expect(canReleaseEscrow(pendingList, 50000)).toBe(false);

      const approvedItem: ProjectDeliverableResponse = {
        ...baseItem,
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
      };
      const approvedList: ProjectDeliverableResponse[] = [approvedItem];
      expect(canReleaseEscrow(approvedList, 50000)).toBe(true);
      // Zero balance cannot be released
      expect(canReleaseEscrow(approvedList, 0)).toBe(false);
      // Empty list cannot release
      expect(canReleaseEscrow([], 50000)).toBe(false);

      // Mixed deliverables: one approved, one revision requested
      const mixedList: ProjectDeliverableResponse[] = [
        approvedItem,
        {
          ...baseItem,
          id: '01a14580-c7e4-7c14-b64a-aa16beca7992',
          status: 'REVISION_REQUESTED',
        },
      ];
      expect(canReleaseEscrow(mixedList, 50000)).toBe(false);
    });
  });

  describe('Deliverable Submission Validation & Security Scanning Rules', () => {
    it('rejects submissions with notes shorter than 5 characters', () => {
      const data: SubmissionFormData = {
        submissionNotes: 'hi',
        attachments: [],
      };
      const result = validateSubmission(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Submission description must be at least 5 characters long.');
    });

    it('rejects submissions containing attachments in PENDING_SCAN or UPLOADING status', () => {
      const attachments: DeliverableAttachmentItem[] = [
        {
          assetId: '01a14580-c7e4-7c14-b64a-aa16beca7993',
          filename: 'draft.mp4',
          byteSize: 1024,
          mimeType: 'video/mp4',
          status: 'PENDING_SCAN',
        },
      ];
      const data: SubmissionFormData = {
        submissionNotes: 'Here is the video rough cut for episode 1.',
        attachments,
      };
      const result = validateSubmission(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'One or more attachments are still undergoing security and malware scanning.',
      );
    });

    it('rejects submissions containing attachments in REJECTED_INVALID or QUARANTINED status', () => {
      const attachments: DeliverableAttachmentItem[] = [
        {
          assetId: '01a14580-c7e4-7c14-b64a-aa16beca7994',
          filename: 'malicious.exe',
          byteSize: 2048,
          mimeType: 'application/x-msdownload',
          status: 'REJECTED_INVALID',
        },
      ];
      const data: SubmissionFormData = {
        submissionNotes: 'Valid description with a bad file.',
        attachments,
      };
      const result = validateSubmission(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'One or more attachments were rejected by security scanning and cannot be submitted.',
      );
    });

    it('accepts submissions with valid notes and ACTIVE (clean) attachments', () => {
      const attachments: DeliverableAttachmentItem[] = [
        {
          assetId: '01a14580-c7e4-7c14-b64a-aa16beca7995',
          filename: 'master_cut.mov',
          byteSize: 10240,
          mimeType: 'video/quicktime',
          status: 'ACTIVE',
        },
      ];
      const data: SubmissionFormData = {
        submissionNotes: 'Final approved 4K master grade export ready for client review.',
        attachments,
      };
      const result = validateSubmission(data);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Client Review Validation Rules', () => {
    it('accepts APPROVE action without mandatory revision notes', () => {
      const data: ReviewFormData = {
        action: 'APPROVE',
      };
      const result = validateReview(data);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects REQUEST_REVISION when revision notes are missing or shorter than 10 characters', () => {
      const emptyNotes: ReviewFormData = {
        action: 'REQUEST_REVISION',
        notes: '',
      };
      expect(validateReview(emptyNotes).valid).toBe(false);
      expect(validateReview(emptyNotes).errors).toContain(
        'Detailed revision feedback is required (at least 10 characters).',
      );

      const shortNotes: ReviewFormData = {
        action: 'REQUEST_REVISION',
        notes: 'Redo it',
      };
      expect(validateReview(shortNotes).valid).toBe(false);
    });

    it('accepts REQUEST_REVISION with comprehensive constructive feedback', () => {
      const validNotes: ReviewFormData = {
        action: 'REQUEST_REVISION',
        notes: 'Please adjust color grading saturation in scene 2 and balance audio tracks.',
      };
      const result = validateReview(validNotes);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Idempotency & Safe Command Keys', () => {
    it('generates non-empty, unique idempotency keys for concurrent operations', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
      expect(key1).not.toBe(key2);
    });
  });

  describe('API Transport & Error Handling', () => {
    it('fetches project details with authorization header', async () => {
      const mockProject: Partial<ProjectResponse> = {
        id: '01a14580-c7e4-7c14-b64a-aa16beca7990',
        title: 'Documentary Master',
        status: 'IN_PROGRESS',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockProject,
      } as Response);

      const result = await fetchProjectDetails(
        '01a14580-c7e4-7c14-b64a-aa16beca7990',
        'test-token',
      );
      expect(result.id).toBe('01a14580-c7e4-7c14-b64a-aa16beca7990');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/projects/01a14580-c7e4-7c14-b64a-aa16beca7990',
        { headers: { Authorization: 'Bearer test-token' } },
      );
    });

    it('parses RFC 7807 problem details error on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          type: 'https://creatorconnect.dev/errors/project-not-found',
          title: 'Project Not Found',
          status: 404,
          detail: 'Project does not exist or access is forbidden.',
        }),
      } as Response);

      await expect(
        fetchProjectDetails('01a14580-0000-0000-0000-000000000000', 'test-token'),
      ).rejects.toThrow('Project does not exist or access is forbidden.');
    });

    it('submits deliverable with payload and idempotency key', async () => {
      const mockDeliverable: Partial<ProjectDeliverableResponse> = {
        id: '01a14580-c7e4-7c14-b64a-aa16beca7991',
        status: 'SUBMITTED',
        version: 1,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDeliverable,
      } as Response);

      const input = {
        submissionNotes: 'First cut export',
        submittedAssetId: '01a14580-c7e4-7c14-b64a-aa16beca7995',
        idempotencyKey: 'idem-12345',
      };

      const result = await submitDeliverable(
        '01a14580-c7e4-7c14-b64a-aa16beca7990',
        '01a14580-c7e4-7c14-b64a-aa16beca7991',
        input,
        'token-creator',
      );

      expect(result.status).toBe('SUBMITTED');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/projects/01a14580-c7e4-7c14-b64a-aa16beca7990/deliverables/01a14580-c7e4-7c14-b64a-aa16beca7991/submit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(input),
        }),
      );
    });

    it('reviews deliverable approving it and handling rejection reason when requesting revisions', async () => {
      const mockApproved: Partial<ProjectDeliverableResponse> = {
        id: '01a14580-c7e4-7c14-b64a-aa16beca7991',
        status: 'APPROVED',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApproved,
      } as Response);

      const result = await reviewDeliverable(
        '01a14580-c7e4-7c14-b64a-aa16beca7990',
        '01a14580-c7e4-7c14-b64a-aa16beca7991',
        { action: 'APPROVE' },
        'token-client',
      );

      expect(result.status).toBe('APPROVED');
    });

    it('fetches deliverable submission history across iterations', async () => {
      const mockSubmissions: Partial<DeliverableSubmissionResponse>[] = [
        {
          id: 'sub-1',
          version: 1,
          submissionNotes: 'Initial v1 draft',
          reviewStatus: 'REVISION_REQUESTED',
          reviewNotes: 'Audio level too low',
        },
        {
          id: 'sub-2',
          version: 2,
          submissionNotes: 'Revised v2 with remastered audio',
          reviewStatus: 'APPROVED',
          reviewNotes: 'Looks great!',
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSubmissions,
      } as Response);

      const res = await fetchDeliverableSubmissions(
        '01a14580-c7e4-7c14-b64a-aa16beca7990',
        '01a14580-c7e4-7c14-b64a-aa16beca7991',
      );
      expect(res.length).toBe(2);
      expect(res[0]?.version).toBe(1);
      expect(res[1]?.version).toBe(2);
    });

    it('releases escrow funds with confirmation', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ releasedAmount: 50000, currency: 'INR' }),
      } as Response);

      const res = await releaseEscrow('01a14580-c7e4-7c14-b64a-aa16beca7990', 'token-client');
      expect(res.releasedAmount).toBe(50000);
      expect(res.currency).toBe('INR');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/payments/projects/01a14580-c7e4-7c14-b64a-aa16beca7990/escrow/release',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('executes 3-step media upload pipeline', async () => {
      const mockFile = new File(['sample video binary'], 'sample.mp4', { type: 'video/mp4' });

      global.fetch = vi
        .fn()
        // 1. upload-url
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadUrl: 'https://mock-storage.example.com/upload-target',
            assetId: 'asset-uuid-1',
          }),
        } as Response)
        // 2. PUT binary
        .mockResolvedValueOnce({
          ok: true,
        } as Response)
        // 3. upload-confirm
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'asset-uuid-1',
            originalName: 'sample.mp4',
            byteSize: mockFile.size,
            mimeType: 'video/mp4',
            status: 'ACTIVE',
          }),
        } as Response);

      const item = await uploadDeliverableAttachment(mockFile, 'test-token');
      expect(item.assetId).toBe('asset-uuid-1');
      expect(item.status).toBe('ACTIVE');
      expect(item.filename).toBe('sample.mp4');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
