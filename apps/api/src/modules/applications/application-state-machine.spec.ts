import { describe, it, expect } from 'vitest';
import { ApplicationStatus } from '@creatorconnect/database';
import {
  VALID_APPLICATION_TRANSITIONS,
  isAllowedApplicationTransition,
  assertValidApplicationTransition,
} from './application-state-machine.js';
import { BadRequestError } from '../../errors/app-error.js';

describe('Application State Machine (F-09 6x6 Matrix)', () => {
  const allStatuses: ApplicationStatus[] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'SHORTLISTED',
    'ACCEPTED',
    'REJECTED',
    'WITHDRAWN',
  ];

  it('verifies the complete state x event test matrix', () => {
    for (const from of allStatuses) {
      const allowedTargets = VALID_APPLICATION_TRANSITIONS[from];
      for (const to of allStatuses) {
        const expectedAllowed = allowedTargets.includes(to);
        const actualAllowed = isAllowedApplicationTransition(from, to);
        expect(
          actualAllowed,
          `Transition from ${from} to ${to} should be ${expectedAllowed ? 'ALLOWED' : 'FORBIDDEN'}`,
        ).toBe(expectedAllowed);

        if (expectedAllowed) {
          expect(() => assertValidApplicationTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertValidApplicationTransition(from, to)).toThrow(BadRequestError);
        }
      }
    }
  });

  it('strictly rejects illegal backward/terminal transitions', () => {
    // Cannot transition from REJECTED to SHORTLISTED or anything else
    expect(isAllowedApplicationTransition('REJECTED', 'SHORTLISTED')).toBe(false);
    expect(isAllowedApplicationTransition('REJECTED', 'UNDER_REVIEW')).toBe(false);
    expect(isAllowedApplicationTransition('REJECTED', 'ACCEPTED')).toBe(false);

    // Cannot transition from ACCEPTED to WITHDRAWN or REJECTED
    expect(isAllowedApplicationTransition('ACCEPTED', 'WITHDRAWN')).toBe(false);
    expect(isAllowedApplicationTransition('ACCEPTED', 'REJECTED')).toBe(false);

    // Cannot transition from WITHDRAWN to SUBMITTED
    expect(isAllowedApplicationTransition('WITHDRAWN', 'SUBMITTED')).toBe(false);

    // Cannot skip directly from SUBMITTED to ACCEPTED
    expect(isAllowedApplicationTransition('SUBMITTED', 'ACCEPTED')).toBe(false);
  });
});
