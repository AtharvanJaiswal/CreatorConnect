import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResolveDisputeInputSchema } from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';
import AdminAuditTrailPage from '../../app/admin/audit/page';
import AdminDisputesPage from '../../app/admin/disputes/page';
import AdminReferralsPage from '../../app/admin/referrals/page';
import {
  validateAuditDateRange,
  getAuditActionBadgeVariant,
  buildResolveDisputePayload,
  RESOLVABLE_DISPUTE_STATUSES,
} from '../../lib/admin-phase41-helpers';

const mockUseAuth = vi.fn();
vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Phase 4.1 Frontend Screens — Contract, Permission & Safety Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Admin Audit Trail (/admin/audit)', () => {
    it('blocks users lacking audit.read permission via PermissionGate locked placeholder', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-support',
          roles: ['ADMIN'],
          adminRoles: ['SUPPORT_ADMIN'],
          adminPermissions: ['support.manage', 'users.read'],
        },
      });

      const html = renderToStaticMarkup(<AdminAuditTrailPage />);
      expect(html).toContain('Restricted action: Requires audit.read administrative privilege.');
      expect(html).not.toContain('Immutable Platform Audit Trail');
    });

    it('renders filter controls, keyset pagination buttons, and zero mock data when authorized', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: 'admin-auditor',
          roles: ['ADMIN'],
          adminRoles: ['USER_ADMIN'],
          adminPermissions: ['users.read', 'audit.read'],
        },
      });

      const html = renderToStaticMarkup(<AdminAuditTrailPage />);
      expect(html).toContain('Immutable Platform Audit Trail');
      expect(html).toContain('Search');
      expect(html).toContain('Entity');
      expect(html).toContain('Exact Action');
      expect(html).toContain('Start Date');
      expect(html).toContain('End Date');
      expect(html).toContain('Previous');
      expect(html).toContain('Next');

      // Must contain ZERO legacy mock audit values
      expect(html).not.toContain('superadmin@creatorconnect.in');
      expect(html).not.toContain('aud-01');
      expect(html).not.toContain('103.21.244.18');
    });

    it('validates date ranges cleanly so startDate > endDate fails before backend call', () => {
      expect(validateAuditDateRange('2026-11-25', '2026-11-20')).toBe(
        'Start date cannot be later than end date.',
      );
      expect(validateAuditDateRange('2026-11-20', '2026-11-20')).toBeNull();
      expect(validateAuditDateRange('2026-11-01', '2026-11-20')).toBeNull();
      expect(validateAuditDateRange('2026-11-01', '')).toBeNull();
      expect(validateAuditDateRange('', '2026-11-20')).toBeNull();
    });

    it('maps administrative action names to deterministic badge variants', () => {
      expect(getAuditActionBadgeVariant('ADMIN_USER_SUSPENDED')).toBe('danger');
      expect(getAuditActionBadgeVariant('CONFIG_UPDATED')).toBe('warning');
      expect(getAuditActionBadgeVariant('REFUND_APPROVED')).toBe('success');
      expect(getAuditActionBadgeVariant('LOGIN')).toBe('neutral');
    });
  });

  describe('2. Admin Disputes Contract & Safety (/admin/disputes)', () => {
    it('renders cleanly with zero hardcoded fake fallback disputes', () => {
      const html = renderToStaticMarkup(<AdminDisputesPage />);
      expect(html).toContain('Contract Disputes');
      expect(html).not.toContain('disp-01');
      expect(html).not.toContain('Dolby 5.1');
    });

    it('validates resolution payloads against shared ResolveDisputeInputSchema', () => {
      const validCreator = buildResolveDisputePayload(
        'RESOLVED_FOR_CREATOR',
        '  Deliverable verified against contract scope.  ',
      );
      expect(validCreator.error).toBeUndefined();
      expect(validCreator.payload).toEqual({
        resolution: 'RESOLVED_FOR_CREATOR',
        resolutionReason: 'Deliverable verified against contract scope.',
      });
      expect(Value.Check(ResolveDisputeInputSchema, validCreator.payload)).toBe(true);

      const validClient = buildResolveDisputePayload(
        'RESOLVED_FOR_CLIENT',
        'Missed deadline without notice.',
      );
      expect(validClient.error).toBeUndefined();
      expect(Value.Check(ResolveDisputeInputSchema, validClient.payload)).toBe(true);

      // Whitespace-only or < 5 char reasons rejected
      expect(buildResolveDisputePayload('RESOLVED_FOR_CREATOR', '     ').error).toContain(
        'at least 5 characters',
      );
      expect(buildResolveDisputePayload('RESOLVED_FOR_CREATOR', 'ok').error).toContain(
        'at least 5 characters',
      );

      // Oversized > 5000 chars rejected
      expect(buildResolveDisputePayload('RESOLVED_FOR_CREATOR', 'x'.repeat(5001)).error).toContain(
        'cannot exceed 5000 characters',
      );

      // Invalid legacy enum values rejected
      expect(buildResolveDisputePayload('SPLIT' as any, 'Valid rationale text').error).toContain(
        'Invalid dispute resolution decision',
      );

      // Resolvable statuses must strictly match backend DisputesService
      expect(RESOLVABLE_DISPUTE_STATUSES.has('OPEN')).toBe(true);
      expect(RESOLVABLE_DISPUTE_STATUSES.has('UNDER_REVIEW')).toBe(true);
      expect(RESOLVABLE_DISPUTE_STATUSES.has('EVIDENCE_REQUESTED')).toBe(true);
      expect(RESOLVABLE_DISPUTE_STATUSES.has('RESOLVED_FOR_CREATOR')).toBe(false);
      expect(RESOLVABLE_DISPUTE_STATUSES.has('RESOLVED_FOR_CLIENT')).toBe(false);
      expect(RESOLVABLE_DISPUTE_STATUSES.has('CLOSED')).toBe(false);
    });
  });

  describe('3. Referrals Feature Safety (/admin/referrals)', () => {
    it('communicates Planned Feature / Not Yet Available state with zero fake metrics or mutations', () => {
      const html = renderToStaticMarkup(<AdminReferralsPage />);
      expect(html).toContain('Planned Feature');
      expect(html).toContain('Backend Implementation Not Yet Available');
      expect(html).toContain('does not display simulated metrics');
      expect(html).not.toContain('Configure Referral Keys in Platform Settings');
      expect(html).not.toMatch(/\d+(\.\d+)?%/);
      expect(html).not.toContain('<table');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('₹');
      expect(html).not.toContain('$');
    });
  });
});
