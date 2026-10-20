import type {
  SavedCreatorItem,
  SavedCreatorListResponse,
  ShortlistResponse,
  ShortlistListResponse,
  CreateShortlistInput,
  UpdateShortlistInput,
  AddShortlistMemberInput,
  ShortlistMemberItem,
  CreateInvitationInput,
  InvitationResponse,
  InvitationListResponse,
} from '@creatorconnect/contracts';

const API_BASE_URL =
  typeof window !== 'undefined'
    ? ''
    : process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export class CollaborationWorkflowService {
  constructor(private baseUrl: string = API_BASE_URL) {}

  private getAuthHeaders(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  // ==============================================================================
  // Saved Creators
  // ==============================================================================

  async saveCreator(creatorId: string, token?: string): Promise<SavedCreatorItem> {
    const res = await fetch(`${this.baseUrl}/api/v1/saved-creators`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify({ creatorId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save creator.');
    }

    return await res.json();
  }

  async unsaveCreator(creatorId: string, token?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/saved-creators/${creatorId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to unsave creator.');
    }

    return await res.json();
  }

  async checkSavedStatus(creatorId: string, token?: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/v1/saved-creators/check/${creatorId}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();
    return Boolean(data.isSaved);
  }

  async listSavedCreators(
    options: { cursor?: string; limit?: number } = {},
    token?: string,
  ): Promise<SavedCreatorListResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/v1/saved-creators${queryStr}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to list saved creators.');
    }

    return await res.json();
  }

  // ==============================================================================
  // Shortlists
  // ==============================================================================

  async createShortlist(input: CreateShortlistInput, token?: string): Promise<ShortlistResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/shortlists`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create shortlist.');
    }

    return await res.json();
  }

  async listShortlists(token?: string): Promise<ShortlistListResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/shortlists`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to list shortlists.');
    }

    return await res.json();
  }

  async getShortlist(id: string, token?: string): Promise<ShortlistResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/shortlists/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to get shortlist.');
    }

    return await res.json();
  }

  async updateShortlist(
    id: string,
    input: UpdateShortlistInput,
    token?: string,
  ): Promise<ShortlistResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/shortlists/${id}`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to update shortlist.');
    }

    return await res.json();
  }

  async deleteShortlist(id: string, token?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/shortlists/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete shortlist.');
    }

    return await res.json();
  }

  async addShortlistMember(
    shortlistId: string,
    input: AddShortlistMemberInput,
    token?: string,
  ): Promise<ShortlistMemberItem> {
    const res = await fetch(`${this.baseUrl}/api/v1/shortlists/${shortlistId}/members`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to add creator to shortlist.');
    }

    return await res.json();
  }

  async removeShortlistMember(
    shortlistId: string,
    creatorId: string,
    token?: string,
  ): Promise<{ success: boolean }> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/shortlists/${shortlistId}/members/${creatorId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders(token),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to remove creator from shortlist.');
    }

    return await res.json();
  }

  // ==============================================================================
  // Hiring Invitations
  // ==============================================================================

  async createInvitation(
    input: CreateInvitationInput,
    token?: string,
  ): Promise<InvitationResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/invitations`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create invitation.');
    }

    return await res.json();
  }

  async listSentInvitations(
    options: { cursor?: string; limit?: number; status?: string } = {},
    token?: string,
  ): Promise<InvitationListResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.status) params.set('status', options.status);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/v1/invitations/sent${queryStr}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to list sent invitations.');
    }

    return await res.json();
  }

  async listReceivedInvitations(
    options: { cursor?: string; limit?: number; status?: string } = {},
    token?: string,
  ): Promise<InvitationListResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.status) params.set('status', options.status);

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/v1/invitations/received${queryStr}`, {
      method: 'GET',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to list received invitations.');
    }

    return await res.json();
  }

  async acceptInvitation(invitationId: string, token?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/invitations/${invitationId}/accept`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to accept invitation.');
    }

    return await res.json();
  }

  async declineInvitation(invitationId: string, token?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/invitations/${invitationId}/decline`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to decline invitation.');
    }

    return await res.json();
  }

  async withdrawInvitation(invitationId: string, token?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/v1/invitations/${invitationId}/withdraw`, {
      method: 'POST',
      headers: this.getAuthHeaders(token),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to withdraw invitation.');
    }

    return await res.json();
  }
}

export const collaborationWorkflowService = new CollaborationWorkflowService();
