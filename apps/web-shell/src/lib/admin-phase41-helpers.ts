import type { DisputeStatus, ResolveDisputeInput } from '@creatorconnect/contracts';

export const AUDIT_PAGE_LIMIT = 20;
export const MAX_AUDIT_SEARCH_LENGTH = 100;

export const MIN_DISPUTE_REASON_LENGTH = 5;
export const MAX_DISPUTE_REASON_LENGTH = 5000;

export const RESOLVABLE_DISPUTE_STATUSES: ReadonlySet<DisputeStatus> = new Set([
  'OPEN',
  'UNDER_REVIEW',
  'EVIDENCE_REQUESTED',
]);

export function getAuditActionBadgeVariant(
  action: string,
): 'danger' | 'warning' | 'success' | 'neutral' {
  if (action.includes('DELETE') || action.includes('SUSPEND') || action.includes('REJECT')) {
    return 'danger';
  }
  if (action.includes('UPDATE') || action.includes('MODERAT') || action.includes('CHANGE')) {
    return 'warning';
  }
  if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('VERIF')) {
    return 'success';
  }
  return 'neutral';
}

export function validateAuditDateRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 'Please select valid start and end dates.';
  }
  if (start.getTime() > end.getTime()) {
    return 'Start date cannot be later than end date.';
  }
  return null;
}

export function buildResolveDisputePayload(
  resolution: ResolveDisputeInput['resolution'],
  rawReason: string,
): { payload?: ResolveDisputeInput; error?: string } {
  if (resolution !== 'RESOLVED_FOR_CREATOR' && resolution !== 'RESOLVED_FOR_CLIENT') {
    return { error: 'Invalid dispute resolution decision.' };
  }

  const trimmed = rawReason.trim();
  if (trimmed.length < MIN_DISPUTE_REASON_LENGTH) {
    return {
      error: `Mandatory adjudication rationale requires at least ${MIN_DISPUTE_REASON_LENGTH} characters.`,
    };
  }
  if (trimmed.length > MAX_DISPUTE_REASON_LENGTH) {
    return {
      error: `Adjudication rationale cannot exceed ${MAX_DISPUTE_REASON_LENGTH} characters.`,
    };
  }

  return {
    payload: {
      resolution,
      resolutionReason: trimmed,
    },
  };
}
