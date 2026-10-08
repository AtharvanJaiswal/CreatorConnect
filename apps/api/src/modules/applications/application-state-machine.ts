import { ApplicationStatus } from '@creatorconnect/database';
import { BadRequestError } from '../../errors/app-error.js';

/**
 * Strict Application Lifecycle Transition Matrix (Phase 4.5 Hardening F-09)
 *
 * Baseline:
 * SUBMITTED -> UNDER_REVIEW -> SHORTLISTED -> ACCEPTED
 *
 * Terminal States:
 * - ACCEPTED: candidate hired; cannot be withdrawn, rejected, or reverted.
 * - REJECTED: candidate declined or position filled; terminal.
 * - WITHDRAWN: candidate retracted proposal; terminal.
 */
export const VALID_APPLICATION_TRANSITIONS: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  SUBMITTED: ['UNDER_REVIEW', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function isAllowedApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  const allowed = VALID_APPLICATION_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export function assertValidApplicationTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): void {
  if (!isAllowedApplicationTransition(from, to)) {
    throw new BadRequestError(`Illegal application status transition from '${from}' to '${to}'.`);
  }
}
