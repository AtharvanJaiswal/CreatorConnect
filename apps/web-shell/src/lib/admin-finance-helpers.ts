import type {
  AdminReconciliationReport,
  AdminRefundListItem,
  CreateRefundRequest,
} from '@creatorconnect/contracts';

export const REFUND_REASON_OPTIONS: ReadonlyArray<{
  value: CreateRefundRequest['reason'];
  label: string;
}> = [
  { value: 'CLIENT_REQUESTED', label: 'Client Requested Settlement' },
  { value: 'DISPUTE_RESOLUTION', label: 'Dispute Resolution Award' },
  { value: 'PROJECT_CANCELLED', label: 'Project Cancelled' },
  { value: 'ADMIN_ADJUSTMENT', label: 'Administrative Adjustment' },
  { value: 'DUPLICATE_PAYMENT', label: 'Duplicate Payment Reversal' },
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatInrMinor(minor: string | number | null | undefined): string {
  if (minor === null || minor === undefined || minor === '') return '₹0.00';
  const parsed = typeof minor === 'number' ? minor : Number(minor);
  if (!Number.isFinite(parsed)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parsed / 100);
}

export function buildCreateRefundPayload(input: {
  paymentIntentId: string;
  amountMinorInput: string;
  reason: string;
  notes: string;
}): { payload?: CreateRefundRequest; error?: string } {
  const paymentIntentId = input.paymentIntentId.trim();
  if (!UUID_REGEX.test(paymentIntentId)) {
    return { error: 'Payment Intent ID must be a valid UUID.' };
  }

  const rawAmount = input.amountMinorInput.trim();
  if (!/^\d+$/.test(rawAmount)) {
    return {
      error:
        'Refund amount must be a positive integer in minor paisa units (e.g. 500000 for ₹5,000.00).',
    };
  }

  const amountMinor = Number(rawAmount);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) {
    return { error: 'Refund amount must be at least 1 paisa.' };
  }

  const validReasons = new Set(REFUND_REASON_OPTIONS.map((r) => r.value));
  if (!validReasons.has(input.reason as CreateRefundRequest['reason'])) {
    return { error: 'Select a valid refund reason category.' };
  }

  const notes = input.notes.trim();
  if (notes.length < 5 || notes.length > 500) {
    return { error: 'Audit notes must be between 5 and 500 characters.' };
  }

  return {
    payload: {
      paymentIntentId,
      amountMinor,
      reason: input.reason as CreateRefundRequest['reason'],
      notes,
    },
  };
}

export function isRefundPendingDualApproval(refund: AdminRefundListItem): boolean {
  return refund.status === 'REQUESTED' || refund.approvalStatus === 'PENDING';
}

export function isSelfRefundApprovalBlocked(
  refund: AdminRefundListItem,
  currentUserId?: string | null,
): boolean {
  return Boolean(currentUserId && refund.refundedById === currentUserId);
}

/**
 * Validates and normalizes canonical AdminReconciliationReport responses from
 * GET /api/v1/admin/reconciliation, failing closed on missing or malformed fields.
 */
export function parseReconciliationReport(raw: unknown): AdminReconciliationReport {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Malformed reconciliation report payload received from backend.');
  }

  const r = raw as Record<string, unknown>;
  if (r.status !== 'BALANCED' && r.status !== 'UNBALANCED') {
    throw new Error('Reconciliation report missing canonical status (BALANCED | UNBALANCED).');
  }
  if (
    typeof r.checkedAt !== 'string' ||
    typeof r.totalAccounts !== 'number' ||
    !Number.isInteger(r.totalAccounts) ||
    typeof r.totalDebitsMinor !== 'string' ||
    typeof r.totalCreditsMinor !== 'string' ||
    typeof r.netDifferenceMinor !== 'string' ||
    !Array.isArray(r.unbalancedAccounts)
  ) {
    throw new Error('Reconciliation report payload does not match canonical contract fields.');
  }

  return {
    status: r.status,
    checkedAt: r.checkedAt,
    totalAccounts: r.totalAccounts,
    totalDebitsMinor: r.totalDebitsMinor,
    totalCreditsMinor: r.totalCreditsMinor,
    netDifferenceMinor: r.netDifferenceMinor,
    unbalancedAccounts: r.unbalancedAccounts as AdminReconciliationReport['unbalancedAccounts'],
  };
}
