import {
  type PrismaClient,
  type Prisma,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportMessageAuthorRole,
  getPrismaClient,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import {
  SupportTicketNotFoundError,
  SupportTicketConflictError,
  SupportTicketInvalidTransitionError,
  SupportTicketClosedError,
} from '../../errors/app-error.js';

export interface CreateTicketRepoInput {
  requesterId: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority | undefined;
  subject: string;
  description: string;
  linkedAssignmentId?: string | undefined;
  linkedProjectId?: string | undefined;
  escrowAmount?: number | undefined;
}

export interface ListCustomerTicketsOptions {
  requesterId: string;
  status?: SupportTicketStatus | undefined;
  category?: SupportTicketCategory | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface ListStaffTicketsOptions {
  status?: SupportTicketStatus | undefined;
  priority?: SupportTicketPriority | undefined;
  category?: SupportTicketCategory | undefined;
  assignedToId?: string | undefined; // userId or 'unassigned'
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface ListMessagesOptions {
  ticketId: string;
  isStaff: boolean;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface AddMessageRepoInput {
  ticketId: string;
  authorId: string;
  authorRole: SupportMessageAuthorRole;
  body: string;
  isInternal?: boolean | undefined;
  mediaAssetId?: string | undefined;
  attachmentName?: string | undefined;
  attachmentSize?: string | undefined;
  attachmentType?: string | undefined;
}

export interface TransitionStatusRepoInput {
  ticketId: string;
  actorId: string;
  newStatus: SupportTicketStatus;
  resolutionSummary?: string | undefined;
  expectedVersion?: number | undefined;
  isStaff: boolean;
}

export class SupportRepository {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  // ==============================================================================
  // Helper: Generate Unique Human-Readable Reference (e.g. SUP-2026-XXXXX)
  // ==============================================================================

  public generateTicketNumber(): string {
    const year = new Date().getFullYear();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPart = '';
    for (let i = 0; i < 5; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `SUP-${year}-${randomPart}`;
  }

  // ==============================================================================
  // Ticket Creation
  // ==============================================================================

  public async createTicket(input: CreateTicketRepoInput) {
    const maxRetries = 3;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const ticketId = generateUuidV7();
      const messageId = generateUuidV7();
      const auditId = generateUuidV7();
      const outboxId = generateUuidV7();
      const ticketNumber = this.generateTicketNumber();

      try {
        return await this.prisma.$transaction(async (tx) => {
          // 1. Create Ticket
          const ticket = await tx.supportTicket.create({
            data: {
              id: ticketId,
              ticketNumber,
              requesterId: input.requesterId,
              category: input.category,
              priority: input.priority ?? 'NORMAL',
              status: 'OPEN',
              subject: input.subject,
              description: input.description,
              linkedAssignmentId: input.linkedAssignmentId ?? null,
              linkedProjectId: input.linkedProjectId ?? null,
              escrowAmount: input.escrowAmount ?? null,
              version: 1,
            },
            include: {
              requester: {
                select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
              },
              assignedTo: {
                select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
              },
            },
          });

          // 2. Create Initial Message
          await tx.supportTicketMessage.create({
            data: {
              id: messageId,
              ticketId: ticket.id,
              authorId: input.requesterId,
              authorRole: 'CUSTOMER',
              body: input.description,
              isInternal: false,
            },
          });

          // 3. Create Support Ticket Audit
          await tx.supportTicketAudit.create({
            data: {
              id: auditId,
              ticketId: ticket.id,
              actorId: input.requesterId,
              action: 'CREATED',
              toStatus: 'OPEN',
              metadata: {
                category: input.category,
                priority: input.priority ?? 'NORMAL',
              },
            },
          });

          // 4. Create Platform AuditLog
          await tx.auditLog.create({
            data: {
              id: generateUuidV7(),
              userId: input.requesterId,
              action: 'SUPPORT_TICKET_CREATED',
              entity: 'SupportTicket',
              entityId: ticket.id,
              metadata: {
                ticketNumber,
                category: input.category,
                subject: input.subject,
              },
            },
          });

          // 5. Create Transactional Outbox Event
          await tx.outboxEvent.create({
            data: {
              id: outboxId,
              eventType: 'support.ticket.created.v1',
              aggregateType: 'SupportTicket',
              aggregateId: ticket.id,
              payload: {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                requesterId: ticket.requesterId,
                category: ticket.category,
                priority: ticket.priority,
                subject: ticket.subject,
              } as Prisma.InputJsonValue,
              status: 'PENDING',
            },
          });

          return ticket;
        });
      } catch (err: any) {
        lastError = err;
        // If Prisma unique constraint violation on ticket_number, retry with new reference
        if (
          err.code === 'P2002' &&
          (err.meta?.target?.includes('ticket_number') ||
            err.meta?.target?.includes('ticketNumber')) &&
          attempt < maxRetries
        ) {
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  // ==============================================================================
  // Ticket Retrieval
  // ==============================================================================

  public async findById(id: string) {
    return this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  public async findByTicketNumber(ticketNumber: string) {
    return this.prisma.supportTicket.findUnique({
      where: { ticketNumber },
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  // ==============================================================================
  // Customer Ticket Queries (Requester Isolation)
  // ==============================================================================

  public async listCustomerTickets(options: ListCustomerTicketsOptions) {
    const limit = Math.min(options.limit ?? 20, 50);
    const where: Prisma.SupportTicketWhereInput = {
      requesterId: options.requesterId,
      ...(options.status ? { status: options.status } : {}),
      ...(options.category ? { category: options.category } : {}),
    };

    let cursorObj: Prisma.SupportTicketWhereUniqueInput | undefined;
    if (options.cursor) {
      cursorObj = { id: options.cursor };
    }

    const items = await this.prisma.supportTicket.findMany({
      where,
      take: limit + 1,
      skip: cursorObj ? 1 : 0,
      ...(cursorObj ? { cursor: cursorObj } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });

    const hasMore = items.length > limit;
    const paginatedItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (paginatedItems[paginatedItems.length - 1]?.id ?? null) : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasMore,
    };
  }

  // ==============================================================================
  // Staff Ticket Queries (Authorized Staff Queue)
  // ==============================================================================

  public async listStaffTickets(options: ListStaffTicketsOptions) {
    const limit = Math.min(options.limit ?? 20, 50);
    const where: Prisma.SupportTicketWhereInput = {
      ...(options.status ? { status: options.status } : {}),
      ...(options.priority ? { priority: options.priority } : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.assignedToId === 'unassigned'
        ? { assignedToId: null }
        : options.assignedToId
          ? { assignedToId: options.assignedToId }
          : {}),
    };

    let cursorObj: Prisma.SupportTicketWhereUniqueInput | undefined;
    if (options.cursor) {
      cursorObj = { id: options.cursor };
    }

    const items = await this.prisma.supportTicket.findMany({
      where,
      take: limit + 1,
      skip: cursorObj ? 1 : 0,
      ...(cursorObj ? { cursor: cursorObj } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });

    const hasMore = items.length > limit;
    const paginatedItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (paginatedItems[paginatedItems.length - 1]?.id ?? null) : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasMore,
    };
  }

  // ==============================================================================
  // Message History (Strict Staff Internal-Note Isolation)
  // ==============================================================================

  public async listMessages(options: ListMessagesOptions) {
    const limit = Math.min(options.limit ?? 50, 100);
    const where: Prisma.SupportTicketMessageWhereInput = {
      ticketId: options.ticketId,
      // If caller is NOT staff, strictly exclude internal notes
      ...(!options.isStaff ? { isInternal: false } : {}),
    };

    let cursorObj: Prisma.SupportTicketMessageWhereUniqueInput | undefined;
    if (options.cursor) {
      cursorObj = { id: options.cursor };
    }

    const items = await this.prisma.supportTicketMessage.findMany({
      where,
      take: limit + 1,
      skip: cursorObj ? 1 : 0,
      ...(cursorObj ? { cursor: cursorObj } : {}),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        author: {
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
    const paginatedItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (paginatedItems[paginatedItems.length - 1]?.id ?? null) : null;

    return {
      items: paginatedItems,
      nextCursor,
      hasMore,
    };
  }

  // ==============================================================================
  // Message Submission (Customer & Staff)
  // ==============================================================================

  public async addMessage(input: AddMessageRepoInput) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Lock/Fetch ticket
      const ticket = await tx.supportTicket.findUnique({
        where: { id: input.ticketId },
      });
      if (!ticket) {
        throw new SupportTicketNotFoundError();
      }

      // Customer cannot reply to closed tickets
      if (ticket.status === 'CLOSED' && input.authorRole === 'CUSTOMER') {
        throw new SupportTicketClosedError();
      }

      // 2. Auto-transition status on customer reply if waiting for customer
      let statusToSet: SupportTicketStatus = ticket.status;
      if (input.authorRole === 'CUSTOMER' && ticket.status === 'WAITING_FOR_CUSTOMER') {
        statusToSet = 'IN_PROGRESS';
      } else if (input.authorRole === 'STAFF' && ticket.status === 'OPEN' && !input.isInternal) {
        statusToSet = 'IN_PROGRESS';
      }

      if (statusToSet !== ticket.status) {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { status: statusToSet, updatedAt: new Date() },
        });

        await tx.supportTicketAudit.create({
          data: {
            id: generateUuidV7(),
            ticketId: ticket.id,
            actorId: input.authorId,
            action: 'STATUS_CHANGED',
            fromStatus: ticket.status,
            toStatus: statusToSet,
            metadata: { trigger: 'message_reply', authorRole: input.authorRole },
          },
        });
      }

      // 3. Create Message
      const messageId = generateUuidV7();
      const message = await tx.supportTicketMessage.create({
        data: {
          id: messageId,
          ticketId: input.ticketId,
          authorId: input.authorId,
          authorRole: input.authorRole,
          body: input.body,
          isInternal: input.isInternal ?? false,
          mediaAssetId: input.mediaAssetId ?? null,
          attachmentName: input.attachmentName ?? null,
          attachmentSize: input.attachmentSize ?? null,
          attachmentType: input.attachmentType ?? null,
        },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });

      // 4. Record Audit
      await tx.supportTicketAudit.create({
        data: {
          id: generateUuidV7(),
          ticketId: ticket.id,
          actorId: input.authorId,
          action: input.isInternal ? 'INTERNAL_NOTE_POSTED' : 'MESSAGE_POSTED',
          metadata: {
            messageId,
            authorRole: input.authorRole,
            isInternal: input.isInternal ?? false,
          },
        },
      });

      // 4b. Record Platform AuditLog
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: input.authorId,
          action: input.isInternal
            ? 'SUPPORT_TICKET_INTERNAL_NOTE_POSTED'
            : 'SUPPORT_TICKET_MESSAGE_POSTED',
          entity: 'SupportTicket',
          entityId: ticket.id,
          metadata: {
            messageId,
            authorRole: input.authorRole,
            isInternal: input.isInternal ?? false,
          },
        },
      });

      // 5. Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: input.isInternal
            ? 'support.ticket.internal_note.created.v1'
            : 'support.ticket.message.created.v1',
          aggregateType: 'SupportTicket',
          aggregateId: ticket.id,
          payload: {
            ticketId: ticket.id,
            messageId,
            authorId: input.authorId,
            authorRole: input.authorRole,
            isInternal: input.isInternal ?? false,
          } as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      return message;
    });
  }

  // ==============================================================================
  // Staff Ticket Assignment
  // ==============================================================================

  public async assignTicket(ticketId: string, actorId: string, assignedToId: string | null) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
      });
      if (!ticket) {
        throw new SupportTicketNotFoundError();
      }

      let newStatus = ticket.status;
      if (assignedToId && ticket.status === 'OPEN') {
        newStatus = 'IN_PROGRESS';
      }

      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          assignedToId,
          status: newStatus,
          version: { increment: 1 },
        },
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
        },
      });

      // 1. Audit
      await tx.supportTicketAudit.create({
        data: {
          id: generateUuidV7(),
          ticketId,
          actorId,
          action: 'ASSIGNED',
          metadata: {
            previousAssigneeId: ticket.assignedToId,
            newAssigneeId: assignedToId,
          },
        },
      });

      // 2. Platform AuditLog
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: actorId,
          action: 'SUPPORT_TICKET_ASSIGNED',
          entity: 'SupportTicket',
          entityId: ticketId,
          metadata: {
            previousAssigneeId: ticket.assignedToId,
            newAssigneeId: assignedToId,
          },
        },
      });

      // 3. Outbox
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'support.ticket.assigned.v1',
          aggregateType: 'SupportTicket',
          aggregateId: ticketId,
          payload: {
            ticketId,
            previousAssigneeId: ticket.assignedToId,
            assignedToId,
          } as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      return updated;
    });
  }

  // ==============================================================================
  // Lifecycle Status Transition (Database-Level Optimistic Locking & Validation)
  // ==============================================================================

  public async transitionStatus(input: TransitionStatusRepoInput) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: input.ticketId },
      });
      if (!ticket) {
        throw new SupportTicketNotFoundError();
      }

      // 1. Optimistic concurrency pre-check
      if (input.expectedVersion !== undefined && ticket.version !== input.expectedVersion) {
        throw new SupportTicketConflictError(
          'Support ticket version mismatch. The ticket has already been updated.',
        );
      }

      // 2. State machine validation
      this.validateTransition(ticket.status, input.newStatus, input.isStaff);

      const isResolved = input.newStatus === 'RESOLVED';
      const isClosed = input.newStatus === 'CLOSED';

      // 3. Database-level atomic conditional update to guarantee concurrency safety
      const updateResult = await tx.supportTicket.updateMany({
        where: {
          id: input.ticketId,
          ...(input.expectedVersion !== undefined ? { version: input.expectedVersion } : {}),
        },
        data: {
          status: input.newStatus,
          resolutionSummary: input.resolutionSummary ?? ticket.resolutionSummary,
          resolvedAt: isResolved ? new Date() : ticket.resolvedAt,
          closedAt: isClosed ? new Date() : ticket.closedAt,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new SupportTicketConflictError(
          'Support ticket was concurrently modified by another user or session.',
        );
      }

      // Fetch the updated authoritative record
      const updated = await tx.supportTicket.findUniqueOrThrow({
        where: { id: input.ticketId },
        include: {
          requester: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
        },
      });

      // 4. Record Domain Audit
      const actionName = isResolved ? 'RESOLVED' : isClosed ? 'CLOSED' : 'STATUS_CHANGED';
      await tx.supportTicketAudit.create({
        data: {
          id: generateUuidV7(),
          ticketId: input.ticketId,
          actorId: input.actorId,
          action: actionName,
          fromStatus: ticket.status,
          toStatus: input.newStatus,
          metadata: {
            resolutionSummary: input.resolutionSummary ?? null,
          },
        },
      });

      // 5. Record Platform AuditLog
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: input.actorId,
          action: `SUPPORT_TICKET_${actionName}`,
          entity: 'SupportTicket',
          entityId: input.ticketId,
          metadata: {
            fromStatus: ticket.status,
            toStatus: input.newStatus,
            resolutionSummary: input.resolutionSummary ?? null,
          },
        },
      });

      // 6. Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: isResolved ? 'support.ticket.resolved.v1' : 'support.ticket.status.changed.v1',
          aggregateType: 'SupportTicket',
          aggregateId: input.ticketId,
          payload: {
            ticketId: input.ticketId,
            previousStatus: ticket.status,
            newStatus: input.newStatus,
            resolutionSummary: input.resolutionSummary ?? null,
            actorId: input.actorId,
          } as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      return updated;
    });
  }

  // ==============================================================================
  // State Machine Guard
  // ==============================================================================

  private validateTransition(
    currentStatus: SupportTicketStatus,
    newStatus: SupportTicketStatus,
    isStaff: boolean,
  ) {
    if (currentStatus === newStatus) {
      return; // Idempotent no-op
    }

    // Allowed transition map
    const transitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
      OPEN: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
      IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'],
      WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['CLOSED', 'IN_PROGRESS', 'OPEN'],
      CLOSED: ['OPEN', 'IN_PROGRESS'], // Only staff may reopen closed tickets
    };

    const allowed = transitions[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new SupportTicketInvalidTransitionError(
        `Cannot transition support ticket from ${currentStatus} to ${newStatus}.`,
      );
    }

    // Customer can only transition to RESOLVED (mark inquiry resolved) or reopen from RESOLVED
    if (!isStaff) {
      if (currentStatus === 'CLOSED') {
        throw new SupportTicketClosedError('Customers cannot reopen closed tickets.');
      }
      if (newStatus === 'RESOLVED') {
        // Allowed from OPEN, IN_PROGRESS, WAITING_FOR_CUSTOMER
        return;
      }
      if (newStatus === 'IN_PROGRESS' && currentStatus === 'RESOLVED') {
        // Allowed: Customer reopening a resolved ticket
        return;
      }
      throw new SupportTicketInvalidTransitionError(
        `Customers are only permitted to resolve an active inquiry or reopen a resolved ticket.`,
      );
    }
  }

  // ==============================================================================
  // Audit Trail Retrieval
  // ==============================================================================

  public async listAudits(ticketId: string) {
    return this.prisma.supportTicketAudit.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const supportRepository = new SupportRepository();
