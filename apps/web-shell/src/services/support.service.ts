import type {
  CreateSupportTicketInput,
  SupportTicketResponse,
  SupportTicketListResponse,
  CreateSupportMessageInput,
  CreateSupportInternalNoteInput,
  SupportTicketMessageResponse,
  SupportTicketMessageListResponse,
  UpdateSupportTicketStatusInput,
  AssignSupportTicketInput,
  CustomerSupportTicketQuery,
  StaffSupportTicketQuery,
} from '@creatorconnect/contracts';

class SupportService {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ==============================================================================
  // Customer Methods
  // ==============================================================================

  async createTicket(
    input: CreateSupportTicketInput,
    token?: string | null,
  ): Promise<SupportTicketResponse> {
    const res = await fetch('/api/v1/support/tickets', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to create support ticket: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async getMyTickets(
    query?: CustomerSupportTicketQuery,
    token?: string | null,
  ): Promise<SupportTicketListResponse> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.category) params.set('category', query.category);
    if (query?.cursor) params.set('cursor', query.cursor);
    if (query?.limit) params.set('limit', String(query.limit));

    const url = `/api/v1/support/tickets${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to fetch support tickets: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async getTicketById(idOrNumber: string, token?: string | null): Promise<SupportTicketResponse> {
    const res = await fetch(`/api/v1/support/tickets/${idOrNumber}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to fetch ticket ${idOrNumber}: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async getMessages(
    ticketId: string,
    options?: { cursor?: string; limit?: number },
    token?: string | null,
  ): Promise<SupportTicketMessageListResponse> {
    const params = new URLSearchParams();
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.limit) params.set('limit', String(options.limit));

    const url = `/api/v1/support/tickets/${ticketId}/messages${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to fetch ticket messages: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async sendMessage(
    ticketId: string,
    input: CreateSupportMessageInput,
    token?: string | null,
  ): Promise<SupportTicketMessageResponse> {
    const res = await fetch(`/api/v1/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to send support message: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async resolveTicket(ticketId: string, token?: string | null): Promise<SupportTicketResponse> {
    const res = await fetch(`/api/v1/support/tickets/${ticketId}/resolve`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to resolve support ticket: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async reopenTicket(ticketId: string, token?: string | null): Promise<SupportTicketResponse> {
    const res = await fetch(`/api/v1/support/tickets/${ticketId}/reopen`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to reopen support ticket: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  // ==============================================================================
  // Staff Methods
  // ==============================================================================

  async getStaffQueue(
    query?: StaffSupportTicketQuery,
    token?: string | null,
  ): Promise<SupportTicketListResponse> {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.priority) params.set('priority', query.priority);
    if (query?.category) params.set('category', query.category);
    if (query?.assignedToId) params.set('assignedToId', query.assignedToId);
    if (query?.cursor) params.set('cursor', query.cursor);
    if (query?.limit) params.set('limit', String(query.limit));

    const url = `/api/v1/staff/support/tickets${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to fetch staff ticket queue: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async assignTicket(
    ticketId: string,
    input: AssignSupportTicketInput,
    token?: string | null,
  ): Promise<SupportTicketResponse> {
    const res = await fetch(`/api/v1/staff/support/tickets/${ticketId}/assign`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.title || `Failed to assign ticket: ${res.statusText}`);
    }

    return await res.json();
  }

  async sendStaffMessage(
    ticketId: string,
    input: CreateSupportMessageInput,
    token?: string | null,
  ): Promise<SupportTicketMessageResponse> {
    const res = await fetch(`/api/v1/staff/support/tickets/${ticketId}/messages`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to send staff response: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async createInternalNote(
    ticketId: string,
    input: CreateSupportInternalNoteInput,
    token?: string | null,
  ): Promise<SupportTicketMessageResponse> {
    const res = await fetch(`/api/v1/staff/support/tickets/${ticketId}/notes`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to create internal note: ${res.statusText}`,
      );
    }

    return await res.json();
  }

  async updateStatus(
    ticketId: string,
    input: UpdateSupportTicketStatusInput,
    token?: string | null,
  ): Promise<SupportTicketResponse> {
    const res = await fetch(`/api/v1/staff/support/tickets/${ticketId}/status`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.detail || err.title || `Failed to update ticket status: ${res.statusText}`,
      );
    }

    return await res.json();
  }
}

export const supportFrontendService = new SupportService();
