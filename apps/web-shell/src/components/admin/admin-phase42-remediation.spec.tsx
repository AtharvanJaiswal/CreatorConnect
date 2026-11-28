import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRefundRequestSchema } from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';
import {
  buildCreateRefundPayload,
  formatInrMinor,
  isRefundPendingDualApproval,
  isSelfRefundApprovalBlocked,
  parseReconciliationReport,
} from '../../lib/admin-finance-helpers';
import { parseAdminApiError } from '../../lib/admin-error';
import { ApiError } from '../../lib/api-client';
import { AdminErrorBanner } from './ui/AdminErrorBanner';
import AdminLifecyclePage from '../../app/admin/lifecycle/page';
import AdminRefundsPage from '../../app/admin/refunds/page';
import AdminReconciliationPage from '../../app/admin/reconciliation/page';
import AdminDashboardPage from '../../app/admin/dashboard/page';
import AdminUsersPage from '../../app/admin/users/page';
import AdminJobsPage from '../../app/admin/jobs/page';

const mockUseAuth = vi.fn();
vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/admin/lifecycle',
}));

describe('Phase 4.2 Admin Console Remediation — Contract, Security & Error UI Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseAuth.mockReturnValue({
      user: {
        id: '018f3a5e-2b1c-7f4d-9a8b-000000000001',
        email: 'ops@creatorconnect.test',
        roles: ['ADMIN'],
        adminRoles: ['FINANCE_ADMIN', 'USER_ADMIN'],
        adminPermissions: [
          'payments.read',
          'payments.refund.request',
          'payments.refund.approve',
          'payments.reconcile',
          'users.read',
          'users.privacy',
          'audit.read',
          'analytics.read',
          'settings.read',
        ],
      },
    });
  });

  describe('Workstream B1: Refunds Contract & Anti-Self-Approval', () => {
    it('builds valid CreateRefundRequest payloads matching TypeBox schema with integer paisa', () => {
      const built = buildCreateRefundPayload({
        paymentIntentId: '0192a0e2-1234-7000-8000-000000000010',
        amountMinorInput: '250000',
        reason: 'CLIENT_REQUESTED',
        notes: 'Mutual client-creator cancellation agreement.',
      });

      expect(built.error).toBeUndefined();
      expect(built.payload).toEqual({
        paymentIntentId: '0192a0e2-1234-7000-8000-000000000010',
        amountMinor: 250000,
        reason: 'CLIENT_REQUESTED',
        notes: 'Mutual client-creator cancellation agreement.',
      });
      expect(Value.Check(CreateRefundRequestSchema, built.payload)).toBe(true);
    });

    it('rejects non-UUID intents, decimals, or notes shorter than 5 characters', () => {
      expect(
        buildCreateRefundPayload({
          paymentIntentId: 'pi-01',
          amountMinorInput: '1000',
          reason: 'CLIENT_REQUESTED',
          notes: 'Valid notes string',
        }).error,
      ).toContain('valid UUID');

      expect(
        buildCreateRefundPayload({
          paymentIntentId: '0192a0e2-1234-7000-8000-000000000010',
          amountMinorInput: '12.34',
          reason: 'CLIENT_REQUESTED',
          notes: 'Valid notes string',
        }).error,
      ).toContain('positive integer');

      expect(
        buildCreateRefundPayload({
          paymentIntentId: '0192a0e2-1234-7000-8000-000000000010',
          amountMinorInput: '1000',
          reason: 'CLIENT_REQUESTED',
          notes: 'ok',
        }).error,
      ).toContain('5 and 500');
    });

    it('detects dual-approval pending state via REQUESTED / PENDING and enforces self-approval lock', () => {
      const refund = {
        id: 'ref-1',
        paymentIntentId: 'pi-1',
        projectId: 'proj-1',
        disputeId: null,
        cancellationId: null,
        refundedById: 'admin-a',
        refundedByEmail: 'a@test.com',
        amountMinor: '5000000',
        currency: 'INR',
        reason: 'CLIENT_REQUESTED',
        status: 'REQUESTED',
        provider: 'RAZORPAY',
        providerRefundId: null,
        approvalId: 'app-1',
        approvalStatus: 'PENDING',
        requiresDualApproval: true,
        notes: 'Needs second officer sign-off',
        processedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(isRefundPendingDualApproval(refund)).toBe(true);
      expect(isSelfRefundApprovalBlocked(refund, 'admin-a')).toBe(true);
      expect(isSelfRefundApprovalBlocked(refund, 'admin-b')).toBe(false);
    });

    it('formats paisa cleanly in INR', () => {
      expect(formatInrMinor('250000')).toContain('2,500.00');
      expect(formatInrMinor('0')).toContain('0.00');
    });
  });

  describe('Workstream B2: Reconciliation Contract Parsing', () => {
    it('parses canonical BALANCED and UNBALANCED reconciliation reports accurately', () => {
      const balanced = parseReconciliationReport({
        status: 'BALANCED',
        checkedAt: '2026-11-27T10:00:00.000Z',
        totalAccounts: 12,
        totalDebitsMinor: '100000',
        totalCreditsMinor: '100000',
        netDifferenceMinor: '0',
        unbalancedAccounts: [],
      });
      expect(balanced.status).toBe('BALANCED');
      expect(balanced.totalAccounts).toBe(12);

      const unbalanced = parseReconciliationReport({
        status: 'UNBALANCED',
        checkedAt: '2026-11-27T10:00:00.000Z',
        totalAccounts: 5,
        totalDebitsMinor: '100000',
        totalCreditsMinor: '99500',
        netDifferenceMinor: '500',
        unbalancedAccounts: [
          {
            id: '0192a0e2-1234-7000-8000-000000000099',
            code: 'LIABILITIES:ESCROW',
            name: 'Escrow',
            type: 'LIABILITY',
            balanceMinor: '50000',
            entriesSumMinor: '49500',
            discrepancyMinor: '500',
          },
        ],
      });
      expect(unbalanced.status).toBe('UNBALANCED');
      expect(unbalanced.unbalancedAccounts).toHaveLength(1);
    });

    it('fails closed on legacy or malformed reconciliation payloads', () => {
      expect(() =>
        parseReconciliationReport({
          isBalanced: true,
          totalDebitMinor: '100',
          totalCreditMinor: '100',
        }),
      ).toThrow();
      expect(() => parseReconciliationReport(null)).toThrow();
    });
  });

  describe('Workstream B: Explicit Error States & Zero Mock Fallbacks', () => {
    it('renders explicit HTTP 401 sign-in CTA and 403 permission diagnostics in AdminErrorBanner', () => {
      const unauthErr = parseAdminApiError(
        new ApiError('Token expired', 401, '/api/v1/admin/users', 'GET', {
          title: 'Unauthorized',
          status: 401,
          code: 'AUTH_EXPIRED',
          detail: 'Bearer JWT expired.',
        }),
      );
      const html401 = renderToStaticMarkup(
        <AdminErrorBanner error={unauthErr} onRetry={() => {}} />,
      );
      expect(html401).toContain('HTTP 401');
      expect(html401).toContain('Sign In Again');
      expect(html401).toContain('Retry');

      const forbiddenErr = parseAdminApiError(
        new ApiError('Forbidden', 403, '/api/v1/admin/refunds', 'GET', {
          title: 'Forbidden',
          status: 403,
          code: 'AUTH_INSUFFICIENT_ROLE',
          detail: 'Missing permission: payments.read',
        }),
      );
      const html403 = renderToStaticMarkup(
        <AdminErrorBanner error={forbiddenErr} onRetry={() => {}} />,
      );
      expect(html403).toContain('HTTP 403');
      expect(html403).toContain('Access Denied (Insufficient Permissions)');
      expect(html403).toContain('Missing permission: payments.read');
      expect(html403).not.toContain('Sign In Again');
    });

    it('renders remediated pages initially without any legacy mock strings', () => {
      const refundsHtml = renderToStaticMarkup(<AdminRefundsPage />);
      expect(refundsHtml).not.toContain('ref-01');
      expect(refundsHtml).not.toContain('pi-01');

      const reconHtml = renderToStaticMarkup(<AdminReconciliationPage />);
      expect(reconHtml).not.toContain('482500000');

      const dashHtml = renderToStaticMarkup(<AdminDashboardPage />);
      expect(dashHtml).not.toContain('2 refund requests require');
      expect(dashHtml).not.toContain('0 Failed');

      const usersHtml = renderToStaticMarkup(<AdminUsersPage />);
      expect(usersHtml).not.toContain('vikram.cinematographer');

      const jobsHtml = renderToStaticMarkup(<AdminJobsPage />);
      expect(jobsHtml).not.toContain('media-transcoding');
    });
  });

  describe('Workstream C: Lifecycle Governance & Legal Hold Safety (/admin/lifecycle)', () => {
    it('displays verified legal-hold lookup panel and explicit Phase 3B.9 BLOCKED gates with zero fake holds', () => {
      const html = renderToStaticMarkup(<AdminLifecyclePage />);
      expect(html).toContain('Stage A Hard-Stop Active');
      expect(html).toContain('0/12 LDR Decisions Approved');
      expect(html).toContain('Global Privacy Queue');
      expect(html).toContain('Retention Policy Matrix');
      expect(html).toContain('Destructive Erasure Execution');
      expect(html).toContain('BLOCKED');
      expect(html).toContain('Per-User Legal Hold Governance');
      // Strictly zero fake hardcoded records
      expect(html).not.toContain('priv-01');
      expect(html).not.toContain('hold-01');
      expect(html).not.toContain('vikram.cinematographer');
    });

    it('gates legal hold lookup controls behind users.privacy permission', () => {
      mockUseAuth.mockReturnValue({
        user: {
          id: '018f3a5e-2b1c-7f4d-9a8b-000000000002',
          email: 'finance@creatorconnect.test',
          roles: ['ADMIN'],
          adminRoles: ['FINANCE_ADMIN'],
          adminPermissions: ['payments.read', 'audit.read'],
        },
      });

      const html = renderToStaticMarkup(<AdminLifecyclePage />);
      expect(html).toContain('Restricted action: Requires users.privacy administrative privilege.');
      expect(html).not.toContain('Inspect Legal Holds');
    });
  });
});
