import { type PrismaClient, getPrismaClient } from '@creatorconnect/database';
import {
  transitionInvitation,
  isInvitationExpired,
  InvalidInvitationTransitionError,
  UnauthorizedInvitationActionError,
} from '@creatorconnect/utils';
import type {
  CreateShortlistInput,
  UpdateShortlistInput,
  AddShortlistMemberInput,
  CreateInvitationInput,
  SavedCreatorListResponse,
  ShortlistResponse,
  ShortlistListResponse,
  InvitationResponse,
  InvitationListResponse,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  UserSuspendedError,
  UserDeactivatedError,
  ProjectNotFoundError,
  ShortlistNotFoundError,
  ShortlistAlreadyExistsError,
  ShortlistMemberAlreadyExistsError,
  ShortlistMemberNotFoundError,
  InvitationNotFoundError,
  InvitationStateError,
  CreatorNotEligibleError,
  DuplicateActiveInvitationError,
} from '../../errors/app-error.js';
import { collaborationRepository, CollaborationRepository } from './collaboration.repository.js';

export class CollaborationService {
  constructor(
    private prisma: PrismaClient = getPrismaClient(),
    private repo: CollaborationRepository = collaborationRepository,
  ) {}

  private async assertUserActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (user.status === 'SUSPENDED') {
      throw new UserSuspendedError('Account is suspended. Access denied.');
    }
    if (user.status === 'DEACTIVATED') {
      throw new UserDeactivatedError('Account is deactivated. Access denied.');
    }
  }

  // ==============================================================================
  // Saved Creators
  // ==============================================================================

  async saveCreator(clientId: string, creatorId: string) {
    await this.assertUserActive(clientId);

    if (clientId === creatorId) {
      throw new BadRequestError('Cannot save your own creator profile.');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: creatorId },
      select: { id: true, status: true },
    });
    if (!creator) {
      throw new NotFoundError('Creator not found.');
    }
    if (creator.status !== 'ACTIVE') {
      throw new CreatorNotEligibleError('Cannot save a suspended or deactivated creator.');
    }

    const saved = await this.repo.saveCreator(clientId, creatorId);

    const displayName =
      [saved.creator.firstName, saved.creator.lastName].filter(Boolean).join(' ') || 'Creator';

    return {
      id: saved.id,
      clientId: saved.clientId,
      creatorId: saved.creatorId,
      createdAt: saved.createdAt.toISOString(),
      creator: {
        id: saved.creator.id,
        displayName,
        avatarUrl: saved.creator.avatarUrl,
        creatorProfile: saved.creator.creatorProfile
          ? {
              id: saved.creator.creatorProfile.id,
              tagline: saved.creator.creatorProfile.tagline,
              startingRate: saved.creator.creatorProfile.startingRate,
              currency: saved.creator.creatorProfile.currency,
              isVerified: saved.creator.creatorProfile.isVerified,
              locationCity: saved.creator.creatorProfile.locationCity,
              locationCountry: saved.creator.creatorProfile.locationCountry,
            }
          : null,
      },
    };
  }

  async unsaveCreator(clientId: string, creatorId: string): Promise<{ success: boolean }> {
    await this.assertUserActive(clientId);
    await this.repo.unsaveCreator(clientId, creatorId);
    return { success: true };
  }

  async checkSavedStatus(clientId: string, creatorId: string): Promise<{ isSaved: boolean }> {
    await this.assertUserActive(clientId);
    const isSaved = await this.repo.isCreatorSaved(clientId, creatorId);
    return { isSaved };
  }

  async listSavedCreators(
    clientId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<SavedCreatorListResponse> {
    await this.assertUserActive(clientId);
    const result = await this.repo.listSavedCreators(clientId, options);

    return {
      items: result.items.map((item: any) => {
        const displayName =
          [item.creator.firstName, item.creator.lastName].filter(Boolean).join(' ') || 'Creator';
        return {
          id: item.id,
          clientId: item.clientId,
          creatorId: item.creatorId,
          createdAt: item.createdAt.toISOString(),
          creator: {
            id: item.creator.id,
            displayName,
            avatarUrl: item.creator.avatarUrl,
            creatorProfile: item.creator.creatorProfile
              ? {
                  id: item.creator.creatorProfile.id,
                  tagline: item.creator.creatorProfile.tagline,
                  startingRate: item.creator.creatorProfile.startingRate,
                  currency: item.creator.creatorProfile.currency,
                  isVerified: item.creator.creatorProfile.isVerified,
                  locationCity: item.creator.creatorProfile.locationCity,
                  locationCountry: item.creator.creatorProfile.locationCountry,
                }
              : null,
          },
        };
      }),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  // ==============================================================================
  // Shortlists
  // ==============================================================================

  async createShortlist(userId: string, input: CreateShortlistInput): Promise<ShortlistResponse> {
    await this.assertUserActive(userId);

    const existing = await this.repo.findShortlistByName(userId, input.name);
    if (existing) {
      throw new ShortlistAlreadyExistsError(`Shortlist with name '${input.name}' already exists.`);
    }

    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, clientId: true },
      });
      if (!project) {
        throw new ProjectNotFoundError('Target project not found.');
      }
      if (project.clientId !== userId) {
        throw new ForbiddenError('You can only associate a shortlist with a project you own.');
      }
    }

    const created = await this.repo.createShortlist({
      ownerId: userId,
      name: input.name,
      description: input.description,
      projectId: input.projectId,
    });

    return {
      id: created.id,
      ownerId: created.ownerId,
      name: created.name,
      description: created.description,
      projectId: created.projectId,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      memberCount: created._count.members,
      project: created.project
        ? {
            id: created.project.id,
            title: created.project.title,
            status: created.project.status,
          }
        : null,
    };
  }

  async getShortlist(userId: string, shortlistId: string): Promise<ShortlistResponse> {
    await this.assertUserActive(userId);

    const shortlist = await this.repo.findShortlistById(shortlistId);
    if (!shortlist) {
      throw new ShortlistNotFoundError('Shortlist not found.');
    }
    if (shortlist.ownerId !== userId) {
      throw new ForbiddenError('You do not have permission to access this shortlist.');
    }

    return {
      id: shortlist.id,
      ownerId: shortlist.ownerId,
      name: shortlist.name,
      description: shortlist.description,
      projectId: shortlist.projectId,
      createdAt: shortlist.createdAt.toISOString(),
      updatedAt: shortlist.updatedAt.toISOString(),
      memberCount: shortlist._count.members,
      project: shortlist.project
        ? {
            id: shortlist.project.id,
            title: shortlist.project.title,
            status: shortlist.project.status,
          }
        : null,
      members: (shortlist.members || []).map((m: any) => {
        const displayName =
          [m.creator.firstName, m.creator.lastName].filter(Boolean).join(' ') || 'Creator';
        return {
          id: m.id,
          shortlistId: m.shortlistId,
          creatorId: m.creatorId,
          note: m.note,
          createdAt: m.createdAt.toISOString(),
          creator: {
            id: m.creator.id,
            displayName,
            avatarUrl: m.creator.avatarUrl,
            creatorProfile: m.creator.creatorProfile
              ? {
                  id: m.creator.creatorProfile.id,
                  tagline: m.creator.creatorProfile.tagline,
                  startingRate: m.creator.creatorProfile.startingRate,
                  currency: m.creator.creatorProfile.currency,
                  isVerified: m.creator.creatorProfile.isVerified,
                }
              : null,
          },
        };
      }),
    };
  }

  async listShortlists(userId: string): Promise<ShortlistListResponse> {
    await this.assertUserActive(userId);
    const result = await this.repo.listShortlistsByOwner(userId);

    return {
      items: result.items.map((item: any) => ({
        id: item.id,
        ownerId: item.ownerId,
        name: item.name,
        description: item.description,
        projectId: item.projectId,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        memberCount: item._count.members,
        project: item.project
          ? {
              id: item.project.id,
              title: item.project.title,
              status: item.project.status,
            }
          : null,
      })),
      total: result.total,
    };
  }

  async updateShortlist(
    userId: string,
    shortlistId: string,
    input: UpdateShortlistInput,
  ): Promise<ShortlistResponse> {
    await this.assertUserActive(userId);

    const existing = await this.repo.findShortlistById(shortlistId);
    if (!existing) {
      throw new ShortlistNotFoundError('Shortlist not found.');
    }
    if (existing.ownerId !== userId) {
      throw new ForbiddenError('You can only update your own shortlist.');
    }

    if (input.name && input.name !== existing.name) {
      const nameConflict = await this.repo.findShortlistByName(userId, input.name);
      if (nameConflict) {
        throw new ShortlistAlreadyExistsError(
          `A shortlist with name '${input.name}' already exists.`,
        );
      }
    }

    if (input.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, clientId: true },
      });
      if (!project) {
        throw new ProjectNotFoundError('Target project not found.');
      }
      if (project.clientId !== userId) {
        throw new ForbiddenError('You can only associate a shortlist with a project you own.');
      }
    }

    const updated = await this.repo.updateShortlist(shortlistId, {
      name: input.name,
      description: input.description,
      projectId: input.projectId,
    });

    return {
      id: updated.id,
      ownerId: updated.ownerId,
      name: updated.name,
      description: updated.description,
      projectId: updated.projectId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      memberCount: updated._count.members,
      project: updated.project
        ? {
            id: updated.project.id,
            title: updated.project.title,
            status: updated.project.status,
          }
        : null,
    };
  }

  async deleteShortlist(userId: string, shortlistId: string): Promise<{ success: boolean }> {
    await this.assertUserActive(userId);

    const existing = await this.repo.findShortlistById(shortlistId);
    if (!existing) {
      throw new ShortlistNotFoundError('Shortlist not found.');
    }
    if (existing.ownerId !== userId) {
      throw new ForbiddenError('You can only delete your own shortlist.');
    }

    await this.repo.deleteShortlist(shortlistId);
    return { success: true };
  }

  async addShortlistMember(userId: string, shortlistId: string, input: AddShortlistMemberInput) {
    await this.assertUserActive(userId);

    const shortlist = await this.repo.findShortlistById(shortlistId);
    if (!shortlist) {
      throw new ShortlistNotFoundError('Shortlist not found.');
    }
    if (shortlist.ownerId !== userId) {
      throw new ForbiddenError('You can only add creators to your own shortlist.');
    }

    const creator = await this.prisma.user.findUnique({
      where: { id: input.creatorId },
      select: { id: true, status: true },
    });
    if (!creator) {
      throw new NotFoundError('Creator not found.');
    }
    if (creator.status !== 'ACTIVE') {
      throw new CreatorNotEligibleError('Cannot add an inactive creator to a shortlist.');
    }

    const existingMember = await this.repo.findShortlistMember(shortlistId, input.creatorId);
    if (existingMember) {
      throw new ShortlistMemberAlreadyExistsError('Creator is already in this shortlist.');
    }

    const member = await this.repo.addShortlistMember({
      shortlistId,
      creatorId: input.creatorId,
      note: input.note,
    });

    const displayName =
      [member.creator.firstName, member.creator.lastName].filter(Boolean).join(' ') || 'Creator';

    return {
      id: member.id,
      shortlistId: member.shortlistId,
      creatorId: member.creatorId,
      note: member.note,
      createdAt: member.createdAt.toISOString(),
      creator: {
        id: member.creator.id,
        displayName,
        avatarUrl: member.creator.avatarUrl,
        creatorProfile: member.creator.creatorProfile
          ? {
              id: member.creator.creatorProfile.id,
              tagline: member.creator.creatorProfile.tagline,
              startingRate: member.creator.creatorProfile.startingRate,
              currency: member.creator.creatorProfile.currency,
              isVerified: member.creator.creatorProfile.isVerified,
            }
          : null,
      },
    };
  }

  async removeShortlistMember(
    userId: string,
    shortlistId: string,
    creatorId: string,
  ): Promise<{ success: boolean }> {
    await this.assertUserActive(userId);

    const shortlist = await this.repo.findShortlistById(shortlistId);
    if (!shortlist) {
      throw new ShortlistNotFoundError('Shortlist not found.');
    }
    if (shortlist.ownerId !== userId) {
      throw new ForbiddenError('You can only remove creators from your own shortlist.');
    }

    const existingMember = await this.repo.findShortlistMember(shortlistId, creatorId);
    if (!existingMember) {
      throw new ShortlistMemberNotFoundError('Creator is not a member of this shortlist.');
    }

    await this.repo.removeShortlistMember(shortlistId, creatorId);
    return { success: true };
  }

  // ==============================================================================
  // Hiring Invitations
  // ==============================================================================

  async createInvitation(
    inviterId: string,
    input: CreateInvitationInput,
  ): Promise<InvitationResponse> {
    await this.assertUserActive(inviterId);

    // 1. Validate project existence & authorization
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      select: {
        id: true,
        title: true,
        clientId: true,
        totalAmount: true,
        currency: true,
        status: true,
      },
    });
    if (!project) {
      throw new ProjectNotFoundError('Target project not found.');
    }
    if (project.clientId !== inviterId) {
      throw new ForbiddenError('Only the project client can send hiring invitations.');
    }
    if (project.status === 'CANCELLED' || project.status === 'DISPUTED') {
      throw new BadRequestError('Cannot send invitations for a cancelled or disputed project.');
    }

    // 2. Validate creator eligibility & account status
    if (inviterId === input.creatorId) {
      throw new BadRequestError('You cannot invite yourself to a project.');
    }

    const invitee = await this.prisma.user.findUnique({
      where: { id: input.creatorId },
      select: {
        id: true,
        status: true,
        creatorProfile: {
          select: {
            id: true,
            visibility: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!invitee) {
      throw new NotFoundError('Creator not found.');
    }
    if (invitee.status !== 'ACTIVE') {
      throw new CreatorNotEligibleError('Invited creator account is suspended or deactivated.');
    }
    if (
      !invitee.creatorProfile ||
      invitee.creatorProfile.visibility === 'PRIVATE' ||
      invitee.creatorProfile.deletedAt !== null
    ) {
      throw new CreatorNotEligibleError('Invited creator profile is not visible or inactive.');
    }

    // 3. Check for existing active PENDING invitation
    const active = await this.repo.findActiveInvitation(input.projectId, input.creatorId);
    if (active) {
      // Check if actually expired
      if (!isInvitationExpired(active.expiresAt)) {
        throw new DuplicateActiveInvitationError(
          'An active pending invitation already exists for this creator on this project.',
        );
      }
    }

    // 4. Validate shortlist reference if provided
    if (input.shortlistId) {
      const shortlist = await this.repo.findShortlistById(input.shortlistId);
      if (!shortlist || shortlist.ownerId !== inviterId) {
        throw new BadRequestError('Provided shortlist does not exist or is not owned by you.');
      }
    }

    // 5. Calculate expiration
    const expiresInDays = input.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invitation = await this.repo.createInvitationWithOutbox({
      projectId: input.projectId,
      inviterId,
      inviteeId: input.creatorId,
      shortlistId: input.shortlistId,
      message: input.message,
      expiresAt,
      projectTitle: project.title,
    });

    const inviterName =
      [invitation.inviter.firstName, invitation.inviter.lastName].filter(Boolean).join(' ') ||
      'Client';
    const inviteeName =
      [invitation.invitee.firstName, invitation.invitee.lastName].filter(Boolean).join(' ') ||
      'Creator';

    return {
      id: invitation.id,
      projectId: invitation.projectId,
      inviterId: invitation.inviterId,
      inviteeId: invitation.inviteeId,
      shortlistId: invitation.shortlistId,
      status: invitation.status as any,
      message: invitation.message,
      expiresAt: invitation.expiresAt ? invitation.expiresAt.toISOString() : null,
      respondedAt: invitation.respondedAt ? invitation.respondedAt.toISOString() : null,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
      project: {
        id: invitation.project.id,
        title: invitation.project.title,
        totalAmount: invitation.project.totalAmount,
        currency: invitation.project.currency,
        status: invitation.project.status,
      },
      inviter: {
        id: invitation.inviter.id,
        displayName: inviterName,
        avatarUrl: invitation.inviter.avatarUrl,
      },
      invitee: {
        id: invitation.invitee.id,
        displayName: inviteeName,
        avatarUrl: invitation.invitee.avatarUrl,
      },
    };
  }

  async getInvitation(userId: string, invitationId: string): Promise<InvitationResponse> {
    await this.assertUserActive(userId);

    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError('Invitation not found.');
    }

    const isParty = invitation.inviterId === userId || invitation.inviteeId === userId;
    if (!isParty) {
      throw new ForbiddenError('You are not authorized to view this invitation.');
    }

    const inviterName =
      [invitation.inviter.firstName, invitation.inviter.lastName].filter(Boolean).join(' ') ||
      'Client';
    const inviteeName =
      [invitation.invitee.firstName, invitation.invitee.lastName].filter(Boolean).join(' ') ||
      'Creator';

    return {
      id: invitation.id,
      projectId: invitation.projectId,
      inviterId: invitation.inviterId,
      inviteeId: invitation.inviteeId,
      shortlistId: invitation.shortlistId,
      status: invitation.status as any,
      message: invitation.message,
      expiresAt: invitation.expiresAt ? invitation.expiresAt.toISOString() : null,
      respondedAt: invitation.respondedAt ? invitation.respondedAt.toISOString() : null,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
      project: {
        id: invitation.project.id,
        title: invitation.project.title,
        totalAmount: invitation.project.totalAmount,
        currency: invitation.project.currency,
        status: invitation.project.status,
      },
      inviter: {
        id: invitation.inviter.id,
        displayName: inviterName,
        avatarUrl: invitation.inviter.avatarUrl,
      },
      invitee: {
        id: invitation.invitee.id,
        displayName: inviteeName,
        avatarUrl: invitation.invitee.avatarUrl,
      },
    };
  }

  async listSentInvitations(
    userId: string,
    options: { cursor?: string; limit?: number; status?: any } = {},
  ): Promise<InvitationListResponse> {
    await this.assertUserActive(userId);
    const result = await this.repo.listSentInvitations(userId, options);

    return {
      items: result.items.map((inv: any) => {
        const inviterName =
          [inv.inviter.firstName, inv.inviter.lastName].filter(Boolean).join(' ') || 'Client';
        const inviteeName =
          [inv.invitee.firstName, inv.invitee.lastName].filter(Boolean).join(' ') || 'Creator';
        return {
          id: inv.id,
          projectId: inv.projectId,
          inviterId: inv.inviterId,
          inviteeId: inv.inviteeId,
          shortlistId: inv.shortlistId,
          status: inv.status as any,
          message: inv.message,
          expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
          respondedAt: inv.respondedAt ? inv.respondedAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
          project: {
            id: inv.project.id,
            title: inv.project.title,
            totalAmount: inv.project.totalAmount,
            currency: inv.project.currency,
            status: inv.project.status,
          },
          inviter: {
            id: inv.inviter.id,
            displayName: inviterName,
            avatarUrl: inv.inviter.avatarUrl,
          },
          invitee: {
            id: inv.invitee.id,
            displayName: inviteeName,
            avatarUrl: inv.invitee.avatarUrl,
          },
        };
      }),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  async listReceivedInvitations(
    userId: string,
    options: { cursor?: string; limit?: number; status?: any } = {},
  ): Promise<InvitationListResponse> {
    await this.assertUserActive(userId);
    const result = await this.repo.listReceivedInvitations(userId, options);

    return {
      items: result.items.map((inv: any) => {
        const inviterName =
          [inv.inviter.firstName, inv.inviter.lastName].filter(Boolean).join(' ') || 'Client';
        const inviteeName =
          [inv.invitee.firstName, inv.invitee.lastName].filter(Boolean).join(' ') || 'Creator';
        return {
          id: inv.id,
          projectId: inv.projectId,
          inviterId: inv.inviterId,
          inviteeId: inv.inviteeId,
          shortlistId: inv.shortlistId,
          status: inv.status as any,
          message: inv.message,
          expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
          respondedAt: inv.respondedAt ? inv.respondedAt.toISOString() : null,
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
          project: {
            id: inv.project.id,
            title: inv.project.title,
            totalAmount: inv.project.totalAmount,
            currency: inv.project.currency,
            status: inv.project.status,
          },
          inviter: {
            id: inv.inviter.id,
            displayName: inviterName,
            avatarUrl: inv.inviter.avatarUrl,
          },
          invitee: {
            id: inv.invitee.id,
            displayName: inviteeName,
            avatarUrl: inv.invitee.avatarUrl,
          },
        };
      }),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  async acceptInvitation(userId: string, invitationId: string): Promise<{ success: boolean }> {
    await this.assertUserActive(userId);

    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError('Invitation not found.');
    }

    // State machine check & role check
    let nextStatus: any;
    try {
      nextStatus = transitionInvitation(invitation.status as any, 'ACCEPT', {
        actorId: userId,
        inviterId: invitation.inviterId,
        inviteeId: invitation.inviteeId,
        expiresAt: invitation.expiresAt,
      });
    } catch (err: unknown) {
      if (err instanceof UnauthorizedInvitationActionError) {
        throw new ForbiddenError(err.message);
      }
      if (err instanceof InvalidInvitationTransitionError) {
        throw new InvitationStateError(err.message);
      }
      throw err;
    }

    const success = await this.repo.atomicUpdateInvitationStatus({
      invitationId,
      expectedStatus: 'PENDING',
      newStatus: nextStatus,
      eventType: 'invitation.accepted.v1',
      notificationTargetUserId: invitation.inviterId,
      notificationType: 'INVITATION_ACCEPTED',
      notificationTitle: 'Invitation Accepted',
      notificationBody: `A creator accepted your invitation for project "${invitation.project.title}".`,
    });

    if (!success) {
      throw new InvitationStateError(
        'Invitation could not be accepted. It may have been modified or expired.',
      );
    }

    return { success: true };
  }

  async declineInvitation(userId: string, invitationId: string): Promise<{ success: boolean }> {
    await this.assertUserActive(userId);

    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError('Invitation not found.');
    }

    // State machine check & role check
    let nextStatus: any;
    try {
      nextStatus = transitionInvitation(invitation.status as any, 'DECLINE', {
        actorId: userId,
        inviterId: invitation.inviterId,
        inviteeId: invitation.inviteeId,
        expiresAt: invitation.expiresAt,
      });
    } catch (err: unknown) {
      if (err instanceof UnauthorizedInvitationActionError) {
        throw new ForbiddenError(err.message);
      }
      if (err instanceof InvalidInvitationTransitionError) {
        throw new InvitationStateError(err.message);
      }
      throw err;
    }

    const success = await this.repo.atomicUpdateInvitationStatus({
      invitationId,
      expectedStatus: 'PENDING',
      newStatus: nextStatus,
      eventType: 'invitation.declined.v1',
      notificationTargetUserId: invitation.inviterId,
      notificationType: 'INVITATION_DECLINED',
      notificationTitle: 'Invitation Declined',
      notificationBody: `A creator declined your invitation for project "${invitation.project.title}".`,
    });

    if (!success) {
      throw new InvitationStateError(
        'Invitation could not be declined. It may have been modified or expired.',
      );
    }

    return { success: true };
  }

  async withdrawInvitation(userId: string, invitationId: string): Promise<{ success: boolean }> {
    await this.assertUserActive(userId);

    const invitation = await this.repo.findInvitationById(invitationId);
    if (!invitation) {
      throw new InvitationNotFoundError('Invitation not found.');
    }

    // State machine check & role check
    let nextStatus: any;
    try {
      nextStatus = transitionInvitation(invitation.status as any, 'WITHDRAW', {
        actorId: userId,
        inviterId: invitation.inviterId,
        inviteeId: invitation.inviteeId,
        expiresAt: invitation.expiresAt,
      });
    } catch (err: unknown) {
      if (err instanceof UnauthorizedInvitationActionError) {
        throw new ForbiddenError(err.message);
      }
      if (err instanceof InvalidInvitationTransitionError) {
        throw new InvitationStateError(err.message);
      }
      throw err;
    }

    const success = await this.repo.atomicUpdateInvitationStatus({
      invitationId,
      expectedStatus: 'PENDING',
      newStatus: nextStatus,
      eventType: 'invitation.withdrawn.v1',
      notificationTargetUserId: invitation.inviteeId,
      notificationType: 'INVITATION_WITHDRAWN',
      notificationTitle: 'Invitation Withdrawn',
      notificationBody: `The client withdrew the invitation for project "${invitation.project.title}".`,
    });

    if (!success) {
      throw new InvitationStateError(
        'Invitation could not be withdrawn. It may have been modified or responded to.',
      );
    }

    return { success: true };
  }
}

export const collaborationService = new CollaborationService();
