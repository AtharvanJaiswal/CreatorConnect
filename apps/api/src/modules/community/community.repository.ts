import {
  type PrismaClient,
  type Prisma,
  CommunityPostType,
  CommunityPostStatus,
  CommunityEventStatus,
  EventRsvpStatus,
  getPrismaClient,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import {
  CommunityPostNotFoundError,
  CommunityEventNotFoundError,
  CommunityEventCapacityExceededError,
} from '../../errors/app-error.js';

export interface ListPostsOptions {
  city?: string | undefined;
  type?: CommunityPostType | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  currentUserId?: string | undefined;
  includeHidden?: boolean | undefined;
}

export interface ListEventsOptions {
  city?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
  currentUserId?: string | undefined;
}

export interface ListCommentsOptions {
  cursor?: string | undefined;
  limit?: number | undefined;
}

export class CommunityRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  // ==============================================================================
  // Helper: Author Summary Projection
  // ==============================================================================

  private projectAuthor(user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    creatorProfile?: { isVerified: boolean; tagline?: string | null } | null;
    userRoles?: Array<{ role: { name: string } }> | null;
  }) {
    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Community Member';
    const initials =
      [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() ||
      fullName.slice(0, 2).toUpperCase();

    const isVerified = user.creatorProfile?.isVerified ?? false;
    const role = user.creatorProfile?.tagline || user.userRoles?.[0]?.role?.name || 'Creator';

    return {
      id: user.id,
      name: fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role,
      isVerified,
      initials,
    };
  }

  // ==============================================================================
  // Posts
  // ==============================================================================

  async listPosts(options: ListPostsOptions) {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

    const where: Prisma.CommunityPostWhereInput = {
      deletedAt: null,
      ...(options.includeHidden ? {} : { status: CommunityPostStatus.ACTIVE }),
      ...(options.city ? { city: { equals: options.city, mode: 'insensitive' } } : {}),
      ...(options.type ? { type: options.type } : {}),
    };

    const posts = await this.prisma.communityPost.findMany({
      where,
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: { isVerified: true, tagline: true },
            },
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
        linkedAssignment: {
          select: {
            id: true,
            title: true,
            budgetMin: true,
            budgetMax: true,
            currency: true,
          },
        },
        linkedEvent: {
          select: {
            id: true,
            title: true,
            venue: true,
            eventDate: true,
            rsvpCount: true,
          },
        },
        ...(options.currentUserId
          ? {
              applauds: {
                where: { userId: options.currentUserId },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    const hasMore = posts.length > limit;
    const sliced = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;
    const total = await this.prisma.communityPost.count({ where });

    return {
      items: sliced.map((p) => ({
        id: p.id,
        authorId: p.authorId,
        author: this.projectAuthor(p.author),
        type: p.type,
        title: p.title,
        body: p.body,
        city: p.city,
        tags: p.tags,
        isPinned: p.isPinned,
        status: p.status,
        linkedAssignmentId: p.linkedAssignmentId,
        linkedAssignment: p.linkedAssignment,
        linkedEventId: p.linkedEventId,
        linkedEvent: p.linkedEvent
          ? {
              ...p.linkedEvent,
              eventDate: p.linkedEvent.eventDate.toISOString(),
            }
          : null,
        applaudsCount: p.applaudsCount,
        hasApplauded: (p as any).applauds ? (p as any).applauds.length > 0 : false,
        commentsCount: p.commentsCount,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      nextCursor,
      total,
    };
  }

  async getPostById(id: string, currentUserId?: string, includeHidden = false) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: { isVerified: true, tagline: true },
            },
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
        linkedAssignment: {
          select: {
            id: true,
            title: true,
            budgetMin: true,
            budgetMax: true,
            currency: true,
          },
        },
        linkedEvent: {
          select: {
            id: true,
            title: true,
            venue: true,
            eventDate: true,
            rsvpCount: true,
          },
        },
        ...(currentUserId
          ? {
              applauds: {
                where: { userId: currentUserId },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    if (!post || post.deletedAt || (!includeHidden && post.status !== CommunityPostStatus.ACTIVE)) {
      throw new CommunityPostNotFoundError();
    }

    return {
      id: post.id,
      authorId: post.authorId,
      author: this.projectAuthor(post.author),
      type: post.type,
      title: post.title,
      body: post.body,
      city: post.city,
      tags: post.tags,
      isPinned: post.isPinned,
      status: post.status,
      linkedAssignmentId: post.linkedAssignmentId,
      linkedAssignment: post.linkedAssignment,
      linkedEventId: post.linkedEventId,
      linkedEvent: post.linkedEvent
        ? {
            ...post.linkedEvent,
            eventDate: post.linkedEvent.eventDate.toISOString(),
          }
        : null,
      applaudsCount: post.applaudsCount,
      hasApplauded: (post as any).applauds ? (post as any).applauds.length > 0 : false,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }

  async createPost(data: {
    authorId: string;
    title: string;
    body: string;
    type?: CommunityPostType;
    city?: string;
    tags?: string[];
    linkedAssignmentId?: string | null;
    linkedEventId?: string | null;
  }) {
    const id = generateUuidV7();
    const city = data.city || 'Mumbai';
    const type = data.type || CommunityPostType.DISCUSSION;
    const tags = data.tags || [];

    return await this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.create({
        data: {
          id,
          authorId: data.authorId,
          title: data.title,
          body: data.body,
          type,
          city,
          tags,
          linkedAssignmentId: data.linkedAssignmentId ?? null,
          linkedEventId: data.linkedEventId ?? null,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              creatorProfile: {
                select: { isVerified: true, tagline: true },
              },
              userRoles: {
                select: { role: { select: { name: true } } },
              },
            },
          },
          linkedAssignment: {
            select: {
              id: true,
              title: true,
              budgetMin: true,
              budgetMax: true,
              currency: true,
            },
          },
          linkedEvent: {
            select: {
              id: true,
              title: true,
              venue: true,
              eventDate: true,
              rsvpCount: true,
            },
          },
        },
      });

      // Outbox event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'community.post.created.v1',
          aggregateType: 'CommunityPost',
          aggregateId: post.id,
          payload: {
            postId: post.id,
            authorId: post.authorId,
            title: post.title,
            type: post.type,
            city: post.city,
            createdAt: post.createdAt.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return {
        id: post.id,
        authorId: post.authorId,
        author: this.projectAuthor(post.author),
        type: post.type,
        title: post.title,
        body: post.body,
        city: post.city,
        tags: post.tags,
        isPinned: post.isPinned,
        status: post.status,
        linkedAssignmentId: post.linkedAssignmentId,
        linkedAssignment: post.linkedAssignment,
        linkedEventId: post.linkedEventId,
        linkedEvent: post.linkedEvent
          ? {
              ...post.linkedEvent,
              eventDate: post.linkedEvent.eventDate.toISOString(),
            }
          : null,
        applaudsCount: post.applaudsCount,
        hasApplauded: false,
        commentsCount: post.commentsCount,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      };
    });
  }

  async applaudPost(postId: string, userId: string) {
    return await this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: { id: true, applaudsCount: true, status: true, deletedAt: true },
      });

      if (!post || post.deletedAt || post.status !== CommunityPostStatus.ACTIVE) {
        throw new CommunityPostNotFoundError();
      }

      const existing = await tx.communityPostApplaud.findUnique({
        where: { postId_userId: { postId, userId } },
      });

      if (existing) {
        // Toggle OFF (un-applaud)
        await tx.communityPostApplaud.delete({
          where: { id: existing.id },
        });

        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: { applaudsCount: { decrement: 1 } },
          select: { applaudsCount: true },
        });

        return {
          postId,
          applauded: false,
          applaudsCount: Math.max(0, updated.applaudsCount),
        };
      } else {
        // Toggle ON (applaud)
        await tx.communityPostApplaud.create({
          data: {
            id: generateUuidV7(),
            postId,
            userId,
          },
        });

        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: { applaudsCount: { increment: 1 } },
          select: { applaudsCount: true },
        });

        return {
          postId,
          applauded: true,
          applaudsCount: updated.applaudsCount,
        };
      }
    });
  }

  // ==============================================================================
  // Comments
  // ==============================================================================

  async createComment(postId: string, authorId: string, content: string) {
    const id = generateUuidV7();

    return await this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: { id: true, status: true, deletedAt: true },
      });

      if (!post || post.deletedAt || post.status !== CommunityPostStatus.ACTIVE) {
        throw new CommunityPostNotFoundError();
      }

      const comment = await tx.communityComment.create({
        data: {
          id,
          postId,
          authorId,
          content,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              creatorProfile: {
                select: { isVerified: true, tagline: true },
              },
              userRoles: {
                select: { role: { select: { name: true } } },
              },
            },
          },
        },
      });

      await tx.communityPost.update({
        where: { id: postId },
        data: { commentsCount: { increment: 1 } },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'community.reply.created.v1',
          aggregateType: 'CommunityComment',
          aggregateId: comment.id,
          payload: {
            commentId: comment.id,
            postId,
            authorId,
            createdAt: comment.createdAt.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return {
        id: comment.id,
        postId: comment.postId,
        authorId: comment.authorId,
        author: this.projectAuthor(comment.author),
        content: comment.content,
        applaudsCount: comment.applaudsCount,
        createdAt: comment.createdAt.toISOString(),
      };
    });
  }

  async listComments(postId: string, options: ListCommentsOptions) {
    const limit = Math.max(1, Math.min(options.limit ?? 50, 100));

    const comments = await this.prisma.communityComment.findMany({
      where: {
        postId,
        deletedAt: null,
      },
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: { isVerified: true, tagline: true },
            },
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
      },
    });

    const hasMore = comments.length > limit;
    const sliced = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;
    const total = await this.prisma.communityComment.count({
      where: { postId, deletedAt: null },
    });

    return {
      items: sliced.map((c) => ({
        id: c.id,
        postId: c.postId,
        authorId: c.authorId,
        author: this.projectAuthor(c.author),
        content: c.content,
        applaudsCount: c.applaudsCount,
        createdAt: c.createdAt.toISOString(),
      })),
      nextCursor,
      total,
    };
  }

  // ==============================================================================
  // Events & RSVPs
  // ==============================================================================

  async listEvents(options: ListEventsOptions) {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 100));

    const where: Prisma.CommunityEventWhereInput = {
      ...(options.city ? { city: { equals: options.city, mode: 'insensitive' } } : {}),
      status: { in: [CommunityEventStatus.UPCOMING, CommunityEventStatus.ONGOING] },
    };

    const events = await this.prisma.communityEvent.findMany({
      where,
      take: limit + 1,
      ...(options.cursor
        ? {
            cursor: { id: options.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { eventDate: 'asc' },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: { isVerified: true, tagline: true },
            },
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
        ...(options.currentUserId
          ? {
              rsvps: {
                where: {
                  userId: options.currentUserId,
                  status: EventRsvpStatus.CONFIRMED,
                },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    const hasMore = events.length > limit;
    const sliced = hasMore ? events.slice(0, limit) : events;
    const nextCursor = hasMore && sliced.length > 0 ? sliced[sliced.length - 1]!.id : null;
    const total = await this.prisma.communityEvent.count({ where });

    return {
      items: sliced.map((e) => ({
        id: e.id,
        organizerId: e.organizerId,
        organizer: this.projectAuthor(e.organizer),
        title: e.title,
        description: e.description,
        city: e.city,
        venue: e.venue,
        eventDate: e.eventDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        isOfficial: e.isOfficial,
        capacity: e.capacity,
        rsvpCount: e.rsvpCount,
        isRsvpd: (e as any).rsvps ? (e as any).rsvps.length > 0 : false,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor,
      total,
    };
  }

  async getEventById(id: string, currentUserId?: string) {
    const event = await this.prisma.communityEvent.findUnique({
      where: { id },
      include: {
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            creatorProfile: {
              select: { isVerified: true, tagline: true },
            },
            userRoles: {
              select: { role: { select: { name: true } } },
            },
          },
        },
        ...(currentUserId
          ? {
              rsvps: {
                where: {
                  userId: currentUserId,
                  status: EventRsvpStatus.CONFIRMED,
                },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    if (!event) {
      throw new CommunityEventNotFoundError();
    }

    return {
      id: event.id,
      organizerId: event.organizerId,
      organizer: this.projectAuthor(event.organizer),
      title: event.title,
      description: event.description,
      city: event.city,
      venue: event.venue,
      eventDate: event.eventDate.toISOString(),
      endDate: event.endDate ? event.endDate.toISOString() : null,
      isOfficial: event.isOfficial,
      capacity: event.capacity,
      rsvpCount: event.rsvpCount,
      isRsvpd: (event as any).rsvps ? (event as any).rsvps.length > 0 : false,
      status: event.status,
      createdAt: event.createdAt.toISOString(),
    };
  }

  async createEvent(data: {
    organizerId: string;
    title: string;
    description: string;
    city: string;
    venue: string;
    eventDate: Date;
    endDate?: Date | null | undefined;
    capacity?: number | null | undefined;
    isOfficial?: boolean | undefined;
  }) {
    const id = generateUuidV7();

    return await this.prisma.$transaction(async (tx) => {
      const event = await tx.communityEvent.create({
        data: {
          id,
          organizerId: data.organizerId,
          title: data.title,
          description: data.description,
          city: data.city,
          venue: data.venue,
          eventDate: data.eventDate,
          endDate: data.endDate ?? null,
          capacity: data.capacity ?? null,
          isOfficial: data.isOfficial ?? false,
        },
        include: {
          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              creatorProfile: {
                select: { isVerified: true, tagline: true },
              },
              userRoles: {
                select: { role: { select: { name: true } } },
              },
            },
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'community.event.created.v1',
          aggregateType: 'CommunityEvent',
          aggregateId: event.id,
          payload: {
            eventId: event.id,
            organizerId: event.organizerId,
            title: event.title,
            city: event.city,
            eventDate: event.eventDate.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return {
        id: event.id,
        organizerId: event.organizerId,
        organizer: this.projectAuthor(event.organizer),
        title: event.title,
        description: event.description,
        city: event.city,
        venue: event.venue,
        eventDate: event.eventDate.toISOString(),
        endDate: event.endDate ? event.endDate.toISOString() : null,
        isOfficial: event.isOfficial,
        capacity: event.capacity,
        rsvpCount: 0,
        isRsvpd: false,
        status: event.status,
        createdAt: event.createdAt.toISOString(),
      };
    });
  }

  async rsvpEvent(
    eventId: string,
    userId: string,
    targetStatus: EventRsvpStatus = EventRsvpStatus.CONFIRMED,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const event = await tx.communityEvent.findUnique({
        where: { id: eventId },
        select: { id: true, capacity: true, rsvpCount: true, status: true },
      });

      if (!event) {
        throw new CommunityEventNotFoundError();
      }

      const existingRsvp = await tx.communityEventRsvp.findUnique({
        where: { eventId_userId: { eventId, userId } },
      });

      if (targetStatus === EventRsvpStatus.CONFIRMED) {
        // Idempotency: If already confirmed, return current state
        if (existingRsvp && existingRsvp.status === EventRsvpStatus.CONFIRMED) {
          return {
            eventId,
            userId,
            status: EventRsvpStatus.CONFIRMED,
            rsvpCount: event.rsvpCount,
          };
        }

        // Capacity check
        if (event.capacity && event.rsvpCount >= event.capacity) {
          throw new CommunityEventCapacityExceededError();
        }

        // Upsert RSVP
        if (existingRsvp) {
          await tx.communityEventRsvp.update({
            where: { id: existingRsvp.id },
            data: { status: EventRsvpStatus.CONFIRMED },
          });
        } else {
          await tx.communityEventRsvp.create({
            data: {
              id: generateUuidV7(),
              eventId,
              userId,
              status: EventRsvpStatus.CONFIRMED,
            },
          });
        }

        const updated = await tx.communityEvent.update({
          where: { id: eventId },
          data: { rsvpCount: { increment: 1 } },
          select: { rsvpCount: true },
        });

        // Outbox event
        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'community.event.rsvp.v1',
            aggregateType: 'CommunityEvent',
            aggregateId: eventId,
            payload: {
              eventId,
              userId,
              status: 'CONFIRMED',
            },
            status: 'PENDING',
          },
        });

        return {
          eventId,
          userId,
          status: EventRsvpStatus.CONFIRMED,
          rsvpCount: updated.rsvpCount,
        };
      } else {
        // targetStatus === EventRsvpStatus.CANCELLED
        // Idempotency: If not confirmed or already cancelled, return no-op
        if (!existingRsvp || existingRsvp.status === EventRsvpStatus.CANCELLED) {
          return {
            eventId,
            userId,
            status: EventRsvpStatus.CANCELLED,
            rsvpCount: event.rsvpCount,
          };
        }

        await tx.communityEventRsvp.update({
          where: { id: existingRsvp.id },
          data: { status: EventRsvpStatus.CANCELLED },
        });

        const updated = await tx.communityEvent.update({
          where: { id: eventId },
          data: { rsvpCount: { decrement: 1 } },
          select: { rsvpCount: true },
        });

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'community.event.rsvp_cancelled.v1',
            aggregateType: 'CommunityEvent',
            aggregateId: eventId,
            payload: {
              eventId,
              userId,
              status: 'CANCELLED',
            },
            status: 'PENDING',
          },
        });

        return {
          eventId,
          userId,
          status: EventRsvpStatus.CANCELLED,
          rsvpCount: Math.max(0, updated.rsvpCount),
        };
      }
    });
  }

  // ==============================================================================
  // Hub Following
  // ==============================================================================

  async followHub(userId: string, city: string) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityHubFollow.findUnique({
        where: { userId_city: { userId, city } },
      });

      if (!existing) {
        await tx.communityHubFollow.create({
          data: {
            id: generateUuidV7(),
            userId,
            city,
          },
        });
      }

      const totalFollowers = await tx.communityHubFollow.count({
        where: { city },
      });

      return {
        city,
        isFollowing: true,
        totalFollowers,
      };
    });
  }

  async unfollowHub(userId: string, city: string) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.communityHubFollow.findUnique({
        where: { userId_city: { userId, city } },
      });

      if (existing) {
        await tx.communityHubFollow.delete({
          where: { id: existing.id },
        });
      }

      const totalFollowers = await tx.communityHubFollow.count({
        where: { city },
      });

      return {
        city,
        isFollowing: false,
        totalFollowers,
      };
    });
  }

  async getUserFollowedHubs(userId: string) {
    const follows = await this.prisma.communityHubFollow.findMany({
      where: { userId },
      select: { city: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      cities: follows.map((f) => f.city),
    };
  }

  // ==============================================================================
  // Moderation
  // ==============================================================================

  async moderatePost(
    postId: string,
    moderatorId: string,
    action: 'HIDE' | 'UNHIDE' | 'DELETE',
    reason: string,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const post = await tx.communityPost.findUnique({
        where: { id: postId },
        select: { id: true, authorId: true, status: true },
      });

      if (!post) {
        throw new CommunityPostNotFoundError();
      }

      let newStatus: CommunityPostStatus;
      let deletedAt: Date | null = null;

      if (action === 'HIDE') {
        newStatus = CommunityPostStatus.HIDDEN;
      } else if (action === 'UNHIDE') {
        newStatus = CommunityPostStatus.ACTIVE;
      } else {
        newStatus = CommunityPostStatus.DELETED;
        deletedAt = new Date();
      }

      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: {
          status: newStatus,
          ...(deletedAt ? { deletedAt } : {}),
        },
      });

      // Audit log in moderation_actions table
      await tx.moderationAction.create({
        data: {
          id: generateUuidV7(),
          moderatorId,
          targetUserId: post.authorId,
          actionType: action === 'DELETE' ? 'CONTENT_REMOVED' : 'WARN',
          reason: `[Community Moderation] Action: ${action} on post ${postId}. Reason: ${reason}`,
        },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'community.post.moderated.v1',
          aggregateType: 'CommunityPost',
          aggregateId: postId,
          payload: {
            postId,
            moderatorId,
            action,
            reason,
            status: newStatus,
          },
          status: 'PENDING',
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        action,
        moderatedAt: new Date().toISOString(),
      };
    });
  }
}

export const communityRepository = new CommunityRepository();
