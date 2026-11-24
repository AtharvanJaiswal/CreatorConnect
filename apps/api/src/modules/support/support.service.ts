import type {
  CreateSupportTicketInput,
  SupportTicketResponse,
  SupportTicketListResponse,
  CreateSupportMessageInput,
  CreateSupportInternalNoteInput,
  SupportTicketMessageResponse,
  SupportTicketMessageListResponse,
  UpdateSupportTicketStatusInput,
  CustomerSupportTicketQuery,
  StaffSupportTicketQuery,
} from '@creatorconnect/contracts';
import {
  SupportTicketNotFoundError,
  SupportTicketForbiddenError,
  SupportStaffUnauthorizedError,
} from '../../errors/app-error.js';
import { supportRepository, SupportRepository } from './support.repository.js';

export class SupportService {
  constructor(private readonly repo: SupportRepository = supportRepository) {}

  // ==============================================================================
  // Helper: Format Ticket DTO
  // ==============================================================================

  private mapTicketResponse(ticket: any): SupportTicketResponse {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      requesterId: ticket.requesterId,
      assignedToId: ticket.assignedToId,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      subject: ticket.subject,
      description: ticket.description,
      linkedAssignmentId: ticket.linkedAssignmentId,
      linkedProjectId: ticket.linkedProjectId,
      escrowAmount: ticket.escrowAmount,
      resolutionSummary: ticket.resolutionSummary,
      version: ticket.version,
      resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : null,
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      ...(ticket.requester
        ? {
            requester: {
              id: ticket.requester.id,
              firstName: ticket.requester.firstName,
              lastName: ticket.requester.lastName,
              email: ticket.requester.email,
              avatarUrl: ticket.requester.avatarUrl,
            },
          }
        : {}),
      assignedTo: ticket.assignedTo
        ? {
            id: ticket.assignedTo.id,
            firstName: ticket.assignedTo.firstName,
            lastName: ticket.assignedTo.lastName,
            avatarUrl: ticket.assignedTo.avatarUrl,
          }
        : null,
    };
  }

  private mapMessageResponse(msg: any): SupportTicketMessageResponse {
    return {
      id: msg.id,
      ticketId: msg.ticketId,
      authorId: msg.authorId,
      authorRole: msg.authorRole,
      body: msg.body,
      isInternal: msg.isInternal,
      mediaAssetId: msg.mediaAssetId,
      attachmentName: msg.attachmentName,
      attachmentSize: msg.attachmentSize,
      attachmentType: msg.attachmentType,
      createdAt: msg.createdAt.toISOString(),
      ...(msg.author
        ? {
            author: {
              id: msg.author.id,
              firstName: msg.author.firstName,
              lastName: msg.author.lastName,
              avatarUrl: msg.author.avatarUrl,
            },
          }
        : {}),
    };
  }

  // ==============================================================================
  // Customer Workflows
  // ==============================================================================

  public async createTicket(
    userId: string,
    input: CreateSupportTicketInput,
  ): Promise<SupportTicketResponse> {
    const ticket = await this.repo.createTicket({
      requesterId: userId,
      category: input.category,
      priority: input.priority,
      subject: input.subject,
      description: input.description,
      linkedAssignmentId: input.linkedAssignmentId,
      linkedProjectId: input.linkedProjectId,
      escrowAmount: input.escrowAmount,
    });
    return this.mapTicketResponse(ticket);
  }

  public async getCustomerTicket(
    userId: string,
    ticketIdOrNumber: string,
  ): Promise<SupportTicketResponse> {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        ticketIdOrNumber,
      );

    const ticket = isUuid
      ? await this.repo.findById(ticketIdOrNumber)
      : await this.repo.findByTicketNumber(ticketIdOrNumber);

    if (!ticket) {
      throw new SupportTicketNotFoundError();
    }

    // IDOR Protection: Customers may only view their own tickets
    if (ticket.requesterId !== userId) {
      throw new SupportTicketForbiddenError('You do not have access to this support ticket.');
    }

    return this.mapTicketResponse(ticket);
  }

  public async listCustomerTickets(
    userId: string,
    query: CustomerSupportTicketQuery,
  ): Promise<SupportTicketListResponse> {
    const result = await this.repo.listCustomerTickets({
      requesterId: userId,
      status: query.status,
      category: query.category,
      cursor: query.cursor,
      limit: query.limit,
    });

    return {
      items: result.items.map((t) => this.mapTicketResponse(t)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  public async listMessages(
    userId: string,
    ticketId: string,
    isStaff: boolean,
    cursor?: string,
    limit?: number,
  ): Promise<SupportTicketMessageListResponse> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) {
      throw new SupportTicketNotFoundError();
    }

    if (!isStaff && ticket.requesterId !== userId) {
      throw new SupportTicketForbiddenError(
        'You do not have permission to view messages for this ticket.',
      );
    }

    const result = await this.repo.listMessages({
      ticketId,
      isStaff,
      cursor,
      limit,
    });

    return {
      items: result.items.map((m) => this.mapMessageResponse(m)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  public async sendCustomerMessage(
    userId: string,
    ticketId: string,
    input: CreateSupportMessageInput,
  ): Promise<SupportTicketMessageResponse> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) {
      throw new SupportTicketNotFoundError();
    }

    if (ticket.requesterId !== userId) {
      throw new SupportTicketForbiddenError(
        'You do not have permission to reply to this support ticket.',
      );
    }

    const message = await this.repo.addMessage({
      ticketId,
      authorId: userId,
      authorRole: 'CUSTOMER',
      body: input.body,
      isInternal: false,
      mediaAssetId: input.mediaAssetId,
      attachmentName: input.attachmentName,
      attachmentSize: input.attachmentSize,
      attachmentType: input.attachmentType,
    });

    return this.mapMessageResponse(message);
  }

  // ==============================================================================
  // Staff Workflows (Enforced Admin/Staff Role)
  // ==============================================================================

  public async getStaffTicket(
    ticketIdOrNumber: string,
    isStaff: boolean,
  ): Promise<SupportTicketResponse> {
    if (!isStaff) {
      throw new SupportStaffUnauthorizedError();
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        ticketIdOrNumber,
      );

    const ticket = isUuid
      ? await this.repo.findById(ticketIdOrNumber)
      : await this.repo.findByTicketNumber(ticketIdOrNumber);

    if (!ticket) {
      throw new SupportTicketNotFoundError();
    }

    return this.mapTicketResponse(ticket);
  }

  public async listStaffTickets(
    query: StaffSupportTicketQuery,
    isStaff: boolean,
  ): Promise<SupportTicketListResponse> {
    if (!isStaff) {
      throw new SupportStaffUnauthorizedError();
    }

    const result = await this.repo.listStaffTickets(query);
    return {
      items: result.items.map((t) => this.mapTicketResponse(t)),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    };
  }

  public async sendStaffMessage(
    staffId: string,
    ticketId: string,
    input: CreateSupportMessageInput,
    isStaff: boolean,
  ): Promise<SupportTicketMessageResponse> {
    if (!isStaff) {
      throw new SupportStaffUnauthorizedError();
    }

    const message = await this.repo.addMessage({
      ticketId,
      authorId: staffId,
      authorRole: 'STAFF',
      body: input.body,
      isInternal: false,
      mediaAssetId: input.mediaAssetId,
      attachmentName: input.attachmentName,
      attachmentSize: input.attachmentSize,
      attachmentType: input.attachmentType,
    });

    return this.mapMessageResponse(message);
  }

  public async createInternalNote(
    staffId: string,
    ticketId: string,
    input: CreateSupportInternalNoteInput,
    isStaff: boolean,
  ): Promise<SupportTicketMessageResponse> {
    if (!isStaff) {
      throw new SupportStaffUnauthorizedError();
    }

    const message = await this.repo.addMessage({
      ticketId,
      authorId: staffId,
      authorRole: 'STAFF',
      body: input.body,
      isInternal: true,
    });

    return this.mapMessageResponse(message);
  }

  public async assignTicket(
    staffId: string,
    ticketId: string,
    assignedToId: string | null,
    isStaff: boolean,
  ): Promise<SupportTicketResponse> {
    if (!isStaff) {
      throw new SupportStaffUnauthorizedError();
    }

    const ticket = await this.repo.assignTicket(ticketId, staffId, assignedToId);
    return this.mapTicketResponse(ticket);
  }

  public async updateStatus(
    userId: string,
    ticketId: string,
    input: UpdateSupportTicketStatusInput,
    isStaff: boolean,
  ): Promise<SupportTicketResponse> {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) {
      throw new SupportTicketNotFoundError();
    }

    if (!isStaff && ticket.requesterId !== userId) {
      throw new SupportTicketForbiddenError(
        'You do not have permission to transition this support ticket.',
      );
    }

    const updated = await this.repo.transitionStatus({
      ticketId,
      actorId: userId,
      newStatus: input.status,
      resolutionSummary: input.resolutionSummary,
      expectedVersion: input.expectedVersion,
      isStaff,
    });

    return this.mapTicketResponse(updated);
  }

  public async resolveTicket(
    userId: string,
    ticketId: string,
    isStaff: boolean,
  ): Promise<SupportTicketResponse> {
    return this.updateStatus(userId, ticketId, { status: 'RESOLVED' }, isStaff);
  }

  public async reopenTicket(
    userId: string,
    ticketId: string,
    isStaff: boolean,
  ): Promise<SupportTicketResponse> {
    return this.updateStatus(userId, ticketId, { status: 'IN_PROGRESS' }, isStaff);
  }

  public async listAudits(ticketId: string, userId: string, isStaff: boolean) {
    const ticket = await this.repo.findById(ticketId);
    if (!ticket) {
      throw new SupportTicketNotFoundError();
    }

    if (!isStaff && ticket.requesterId !== userId) {
      throw new SupportTicketForbiddenError();
    }

    return this.repo.listAudits(ticketId);
  }
}

export const supportService = new SupportService();
