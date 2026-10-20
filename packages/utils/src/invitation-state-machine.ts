export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED';

export type InvitationAction = 'ACCEPT' | 'DECLINE' | 'WITHDRAW' | 'EXPIRE';

export interface TransitionContext {
  actorId: string;
  inviterId: string;
  inviteeId: string;
  now?: Date;
  expiresAt?: Date | null;
}

export const VALID_INVITATION_TRANSITIONS: Record<InvitationStatus, readonly InvitationStatus[]> = {
  PENDING: ['ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'],
  ACCEPTED: [],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
};

export class InvalidInvitationTransitionError extends Error {
  constructor(
    public readonly fromStatus: InvitationStatus,
    public readonly action: InvitationAction,
    reason: string,
  ) {
    super(`Cannot transition invitation from ${fromStatus} via action ${action}: ${reason}`);
    this.name = 'InvalidInvitationTransitionError';
  }
}

export class UnauthorizedInvitationActionError extends Error {
  constructor(
    public readonly actorId: string,
    public readonly action: InvitationAction,
    reason: string,
  ) {
    super(`Unauthorized action ${action} by actor ${actorId}: ${reason}`);
    this.name = 'UnauthorizedInvitationActionError';
  }
}

export function isTerminalInvitationStatus(status: InvitationStatus): boolean {
  return status !== 'PENDING';
}

export function isInvitationExpired(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return now.getTime() >= expiry.getTime();
}

/**
 * Validates and calculates the next status for an invitation.
 * Enforces role-based permissions, expiration checks, and terminal state immutability.
 */
export function transitionInvitation(
  currentStatus: InvitationStatus,
  action: InvitationAction,
  context: TransitionContext,
): InvitationStatus {
  const now = context.now ?? new Date();

  // If currently pending but expired by time, reject accept/decline/withdraw
  if (currentStatus === 'PENDING' && isInvitationExpired(context.expiresAt, now)) {
    if (action === 'EXPIRE') {
      return 'EXPIRED';
    }
    throw new InvalidInvitationTransitionError(
      currentStatus,
      action,
      'Invitation has expired and can no longer be transitioned.',
    );
  }

  // Guard terminal states
  if (isTerminalInvitationStatus(currentStatus)) {
    throw new InvalidInvitationTransitionError(
      currentStatus,
      action,
      `Invitation is in terminal state '${currentStatus}' and cannot be altered.`,
    );
  }

  switch (action) {
    case 'ACCEPT': {
      if (context.actorId !== context.inviteeId) {
        throw new UnauthorizedInvitationActionError(
          context.actorId,
          action,
          'Only the invited creator may accept this invitation.',
        );
      }
      return 'ACCEPTED';
    }

    case 'DECLINE': {
      if (context.actorId !== context.inviteeId) {
        throw new UnauthorizedInvitationActionError(
          context.actorId,
          action,
          'Only the invited creator may decline this invitation.',
        );
      }
      return 'DECLINED';
    }

    case 'WITHDRAW': {
      if (context.actorId !== context.inviterId) {
        throw new UnauthorizedInvitationActionError(
          context.actorId,
          action,
          'Only the inviter client may withdraw this invitation.',
        );
      }
      return 'WITHDRAWN';
    }

    case 'EXPIRE': {
      return 'EXPIRED';
    }

    default: {
      throw new InvalidInvitationTransitionError(
        currentStatus,
        action,
        `Unknown invitation action '${action}'.`,
      );
    }
  }
}
