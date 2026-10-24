import { describe, it, expect } from 'vitest';
import {
  transitionInvitation,
  isInvitationExpired,
  isTerminalInvitationStatus,
  InvalidInvitationTransitionError,
  UnauthorizedInvitationActionError,
} from './invitation-state-machine.js';

describe('Invitation State Machine (Phase 11)', () => {
  const inviterId = '019183ab-1234-7000-8000-000000000001';
  const inviteeId = '019183ab-1234-7000-8000-000000000002';
  const thirdPartyId = '019183ab-1234-7000-8000-000000000003';

  it('allows authorized invitee to ACCEPT a PENDING invitation', () => {
    const next = transitionInvitation('PENDING', 'ACCEPT', {
      actorId: inviteeId,
      inviterId,
      inviteeId,
    });
    expect(next).toBe('ACCEPTED');
  });

  it('rejects ACCEPT if actor is not the invitee', () => {
    expect(() =>
      transitionInvitation('PENDING', 'ACCEPT', {
        actorId: inviterId,
        inviterId,
        inviteeId,
      }),
    ).toThrow(UnauthorizedInvitationActionError);

    expect(() =>
      transitionInvitation('PENDING', 'ACCEPT', {
        actorId: thirdPartyId,
        inviterId,
        inviteeId,
      }),
    ).toThrow(UnauthorizedInvitationActionError);
  });

  it('allows authorized invitee to DECLINE a PENDING invitation', () => {
    const next = transitionInvitation('PENDING', 'DECLINE', {
      actorId: inviteeId,
      inviterId,
      inviteeId,
    });
    expect(next).toBe('DECLINED');
  });

  it('rejects DECLINE if actor is not the invitee', () => {
    expect(() =>
      transitionInvitation('PENDING', 'DECLINE', {
        actorId: inviterId,
        inviterId,
        inviteeId,
      }),
    ).toThrow(UnauthorizedInvitationActionError);
  });

  it('allows authorized inviter to WITHDRAW a PENDING invitation', () => {
    const next = transitionInvitation('PENDING', 'WITHDRAW', {
      actorId: inviterId,
      inviterId,
      inviteeId,
    });
    expect(next).toBe('WITHDRAWN');
  });

  it('rejects WITHDRAW if actor is not the inviter', () => {
    expect(() =>
      transitionInvitation('PENDING', 'WITHDRAW', {
        actorId: inviteeId,
        inviterId,
        inviteeId,
      }),
    ).toThrow(UnauthorizedInvitationActionError);
  });

  it('transitions to EXPIRED on EXPIRE action', () => {
    const next = transitionInvitation('PENDING', 'EXPIRE', {
      actorId: 'system',
      inviterId,
      inviteeId,
    });
    expect(next).toBe('EXPIRED');
  });

  it('detects expiration when current time >= expiresAt', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const past = new Date('2026-10-17T11:59:59Z');
    const future = new Date('2026-10-17T12:00:01Z');

    expect(isInvitationExpired(past, now)).toBe(true);
    expect(isInvitationExpired(future, now)).toBe(false);
    expect(isInvitationExpired(null, now)).toBe(false);
    expect(isInvitationExpired(undefined, now)).toBe(false);
  });

  it('rejects ACCEPT/DECLINE/WITHDRAW if invitation is already expired by timestamp', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    const past = new Date('2026-10-17T11:00:00Z');

    expect(() =>
      transitionInvitation('PENDING', 'ACCEPT', {
        actorId: inviteeId,
        inviterId,
        inviteeId,
        now,
        expiresAt: past,
      }),
    ).toThrow(InvalidInvitationTransitionError);
  });

  it('forbids mutating terminal states (ACCEPTED, DECLINED, WITHDRAWN, EXPIRED)', () => {
    const terminalStates = ['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'] as const;

    for (const state of terminalStates) {
      expect(isTerminalInvitationStatus(state)).toBe(true);

      expect(() =>
        transitionInvitation(state, 'ACCEPT', {
          actorId: inviteeId,
          inviterId,
          inviteeId,
        }),
      ).toThrow(InvalidInvitationTransitionError);

      expect(() =>
        transitionInvitation(state, 'DECLINE', {
          actorId: inviteeId,
          inviterId,
          inviteeId,
        }),
      ).toThrow(InvalidInvitationTransitionError);

      expect(() =>
        transitionInvitation(state, 'WITHDRAW', {
          actorId: inviterId,
          inviterId,
          inviteeId,
        }),
      ).toThrow(InvalidInvitationTransitionError);
    }
  });
});
