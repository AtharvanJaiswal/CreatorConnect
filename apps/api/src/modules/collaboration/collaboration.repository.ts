import { type Prisma, type InvitationStatus, getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

export class CollaborationRepository {
  constructor(private prisma: any = getPrismaClient()) {}

  // ==============================================================================
  // Saved Creators
  // ==============================================================================

  async saveCreator(clientId: string, creatorId: string) {
    const id = generateUuidV7();
    return await this.prisma.savedCreator.upsert({
      where: {
        clientId_creatorId: {
          clientId,
          creatorId,
        },
      },
      create: {
        id,
        clientId,
        creatorId,
      },
      update: {},
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: {
                id: true,
                tagline: true,
                startingRate: true,
                currency: true,
                isVerified: true,
                locationCity: true,
                locationCountry: true,
              },
            },
          },
        },
      },
    });
  }

  async unsaveCreator(clientId: string, creatorId: string): Promise<boolean> {
    const result = await this.prisma.savedCreator.deleteMany({
      where: {
        clientId,
        creatorId,
      },
    });
    return result.count > 0;
  }

  async isCreatorSaved(clientId: string, creatorId: string): Promise<boolean> {
    const record = await this.prisma.savedCreator.findUnique({
      where: {
        clientId_creatorId: {
          clientId,
          creatorId,
        },
      },
      select: { id: true },
    });
    return record !== null;
  }

  async listSavedCreators(
    clientId: string,
    options: { cursor?: string | undefined; limit?: number | undefined } = {},
  ) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const items = await this.prisma.savedCreator.findMany({
      where: { clientId },
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: {
                id: true,
                tagline: true,
                startingRate: true,
                currency: true,
                isVerified: true,
                locationCity: true,
                locationCountry: true,
              },
            },
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;
    const total = await this.prisma.savedCreator.count({ where: { clientId } });

    return {
      items: sliced,
      nextCursor,
      total,
    };
  }

  // ==============================================================================
  // Shortlists
  // ==============================================================================

  async createShortlist(data: {
    ownerId: string;
    name: string;
    description?: string | null | undefined;
    projectId?: string | null | undefined;
  }) {
    const id = generateUuidV7();
    return await this.prisma.shortlist.create({
      data: {
        id,
        ownerId: data.ownerId,
        name: data.name,
        description: data.description ?? null,
        projectId: data.projectId ?? null,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findShortlistById(id: string) {
    return await this.prisma.shortlist.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        members: {
          orderBy: { createdAt: 'desc' },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                creatorProfile: {
                  select: {
                    id: true,
                    tagline: true,
                    startingRate: true,
                    currency: true,
                    isVerified: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async findShortlistByName(ownerId: string, name: string) {
    return await this.prisma.shortlist.findUnique({
      where: {
        ownerId_name: {
          ownerId,
          name,
        },
      },
    });
  }

  async listShortlistsByOwner(ownerId: string) {
    const items = await this.prisma.shortlist.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    return {
      items,
      total: items.length,
    };
  }

  async updateShortlist(
    id: string,
    data: {
      name?: string | undefined;
      description?: string | null | undefined;
      projectId?: string | null | undefined;
    },
  ) {
    return await this.prisma.shortlist.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async deleteShortlist(id: string) {
    return await this.prisma.shortlist.delete({
      where: { id },
    });
  }

  async addShortlistMember(data: {
    shortlistId: string;
    creatorId: string;
    note?: string | null | undefined;
  }) {
    const id = generateUuidV7();
    return await this.prisma.shortlistMember.create({
      data: {
        id,
        shortlistId: data.shortlistId,
        creatorId: data.creatorId,
        note: data.note ?? null,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: {
                id: true,
                tagline: true,
                startingRate: true,
                currency: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });
  }

  async findShortlistMember(shortlistId: string, creatorId: string) {
    return await this.prisma.shortlistMember.findUnique({
      where: {
        shortlistId_creatorId: {
          shortlistId,
          creatorId,
        },
      },
    });
  }

  async removeShortlistMember(shortlistId: string, creatorId: string) {
    return await this.prisma.shortlistMember.delete({
      where: {
        shortlistId_creatorId: {
          shortlistId,
          creatorId,
        },
      },
    });
  }

  // ==============================================================================
  // Hiring Invitations
  // ==============================================================================

  async createInvitationWithOutbox(data: {
    projectId: string;
    inviterId: string;
    inviteeId: string;
    shortlistId?: string | null | undefined;
    message: string;
    expiresAt?: Date | null | undefined;
    projectTitle: string;
  }) {
    const invitationId = generateUuidV7();
    const outboxEventId = generateUuidV7();
    const notificationId = generateUuidV7();

    return await this.prisma.$transaction(async (tx: any) => {
      const invitation = await tx.projectInvitation.create({
        data: {
          id: invitationId,
          projectId: data.projectId,
          inviterId: data.inviterId,
          inviteeId: data.inviteeId,
          shortlistId: data.shortlistId ?? null,
          message: data.message,
          expiresAt: data.expiresAt ?? null,
          status: 'PENDING',
        },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              totalAmount: true,
              currency: true,
              status: true,
            },
          },
          inviter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          invitee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Write Outbox Event atomically
      await tx.outboxEvent.create({
        data: {
          id: outboxEventId,
          eventType: 'invitation.created.v1',
          aggregateType: 'ProjectInvitation',
          aggregateId: invitationId,
          payload: {
            invitationId,
            projectId: data.projectId,
            inviterId: data.inviterId,
            inviteeId: data.inviteeId,
            expiresAt: data.expiresAt ? data.expiresAt.toISOString() : null,
          } as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      // Write in-app Notification for the invitee creator
      await tx.notification.create({
        data: {
          id: notificationId,
          userId: data.inviteeId,
          eventId: outboxEventId,
          type: 'INVITATION_RECEIVED' as any,
          title: 'Project Collaboration Invitation',
          body: `You received a collaboration invitation for project "${data.projectTitle}".`,
          data: {
            invitationId,
            projectId: data.projectId,
          } as Prisma.InputJsonValue,
        },
      });

      return invitation;
    });
  }

  async findInvitationById(id: string) {
    return await this.prisma.projectInvitation.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        },
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        invitee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async findActiveInvitation(projectId: string, inviteeId: string) {
    return await this.prisma.projectInvitation.findFirst({
      where: {
        projectId,
        inviteeId,
        status: 'PENDING',
      },
    });
  }

  async listSentInvitations(
    inviterId: string,
    options: {
      cursor?: string | undefined;
      limit?: number | undefined;
      status?: InvitationStatus | undefined;
    } = {},
  ) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const where: any = {
      inviterId,
      ...(options.status ? { status: options.status } : {}),
    };

    const items = await this.prisma.projectInvitation.findMany({
      where,
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        },
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        invitee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;
    const total = await this.prisma.projectInvitation.count({ where });

    return {
      items: sliced,
      nextCursor,
      total,
    };
  }

  async listReceivedInvitations(
    inviteeId: string,
    options: {
      cursor?: string | undefined;
      limit?: number | undefined;
      status?: InvitationStatus | undefined;
    } = {},
  ) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

    const where: any = {
      inviteeId,
      ...(options.status ? { status: options.status } : {}),
    };

    const items = await this.prisma.projectInvitation.findMany({
      where,
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        },
        inviter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        invitee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;
    const total = await this.prisma.projectInvitation.count({ where });

    return {
      items: sliced,
      nextCursor,
      total,
    };
  }

  /**
   * Atomic conditional status transition with transactional outbox and notification.
   * Concurrency Safe: Uses updateMany with exact expected status condition.
   */
  async atomicUpdateInvitationStatus(params: {
    invitationId: string;
    expectedStatus: InvitationStatus;
    newStatus: InvitationStatus;
    eventType: string;
    notificationTargetUserId: string;
    notificationType: any;
    notificationTitle: string;
    notificationBody: string;
  }): Promise<boolean> {
    const outboxEventId = generateUuidV7();
    const notificationId = generateUuidV7();
    const now = new Date();

    return await this.prisma.$transaction(async (tx: any) => {
      // Concurrency check: conditional update ensures only one transition wins
      const updateResult = await tx.projectInvitation.updateMany({
        where: {
          id: params.invitationId,
          status: params.expectedStatus,
        },
        data: {
          status: params.newStatus,
          respondedAt: now,
          updatedAt: now,
        },
      });

      if (updateResult.count === 0) {
        return false;
      }

      // Write Outbox Event atomically
      await tx.outboxEvent.create({
        data: {
          id: outboxEventId,
          eventType: params.eventType,
          aggregateType: 'ProjectInvitation',
          aggregateId: params.invitationId,
          payload: {
            invitationId: params.invitationId,
            status: params.newStatus,
            respondedAt: now.toISOString(),
          } as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      // Write in-app Notification for the counterparty
      await tx.notification.create({
        data: {
          id: notificationId,
          userId: params.notificationTargetUserId,
          eventId: outboxEventId,
          type: params.notificationType,
          title: params.notificationTitle,
          body: params.notificationBody,
          data: {
            invitationId: params.invitationId,
            status: params.newStatus,
          } as Prisma.InputJsonValue,
        },
      });

      return true;
    });
  }
}

export const collaborationRepository = new CollaborationRepository();
