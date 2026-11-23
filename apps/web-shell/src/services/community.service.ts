import type {
  CreateCommunityPostInput,
  CommunityPostItem,
  CommunityPostListResponse,
  CreateCommunityCommentInput,
  CommunityCommentItem,
  CommunityCommentListResponse,
  CommunityEventItem,
  CommunityEventListResponse,
  EventRsvpResponse,
  HubFollowResponse,
  UserFollowedHubsResponse,
  ModerateCommunityPostInput,
} from '@creatorconnect/contracts';

class CommunityService {
  private getHeaders(token?: string | null): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getPosts(
    options: {
      city?: string | undefined;
      type?: string | undefined;
      cursor?: string | undefined;
      limit?: number | undefined;
    } = {},
    token?: string | null | undefined,
  ): Promise<CommunityPostListResponse> {
    const params = new URLSearchParams();
    if (options.city) params.set('city', options.city);
    if (options.type && options.type !== 'all') params.set('type', options.type.toUpperCase());
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const url = `/api/v1/community/posts${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch community posts: ${res.statusText}`);
    }

    return await res.json();
  }

  async getPostById(id: string, token?: string | null): Promise<CommunityPostItem> {
    const res = await fetch(`/api/v1/community/posts/${id}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch community post ${id}: ${res.statusText}`);
    }

    return await res.json();
  }

  async createPost(input: CreateCommunityPostInput, token: string): Promise<CommunityPostItem> {
    const res = await fetch('/api/v1/community/posts', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create community post: ${res.statusText}`);
    }

    return await res.json();
  }

  async applaudPost(
    id: string,
    token: string,
  ): Promise<{ postId: string; applauded: boolean; applaudsCount: number }> {
    const res = await fetch(`/api/v1/community/posts/${id}/applaud`, {
      method: 'POST',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Failed to applaud post: ${res.statusText}`);
    }

    return await res.json();
  }

  async getComments(
    postId: string,
    options: { cursor?: string | undefined; limit?: number | undefined } = {},
  ): Promise<CommunityCommentListResponse> {
    const params = new URLSearchParams();
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const url = `/api/v1/community/posts/${postId}/comments${
      params.toString() ? `?${params.toString()}` : ''
    }`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch comments for post ${postId}`);
    }

    return await res.json();
  }

  async createComment(
    postId: string,
    content: string,
    token: string,
  ): Promise<CommunityCommentItem> {
    const res = await fetch(`/api/v1/community/posts/${postId}/comments`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ content } satisfies CreateCommunityCommentInput),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to post reply: ${res.statusText}`);
    }

    return await res.json();
  }

  async getEvents(
    options: {
      city?: string | undefined;
      cursor?: string | undefined;
      limit?: number | undefined;
    } = {},
    token?: string | null | undefined,
  ): Promise<CommunityEventListResponse> {
    const params = new URLSearchParams();
    if (options.city) params.set('city', options.city);
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const url = `/api/v1/community/events${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch community events: ${res.statusText}`);
    }

    return await res.json();
  }

  async getEventById(id: string, token?: string | null): Promise<CommunityEventItem> {
    const res = await fetch(`/api/v1/community/events/${id}`, {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch community event ${id}`);
    }

    return await res.json();
  }

  async rsvpEvent(
    eventId: string,
    status: 'CONFIRMED' | 'CANCELLED',
    token: string,
  ): Promise<EventRsvpResponse> {
    const res = await fetch(`/api/v1/community/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to RSVP to event: ${res.statusText}`);
    }

    return await res.json();
  }

  async getFollowedHubs(token: string): Promise<UserFollowedHubsResponse> {
    const res = await fetch('/api/v1/community/hubs/following', {
      method: 'GET',
      headers: this.getHeaders(token),
    });

    if (!res.ok) {
      throw new Error('Failed to fetch followed hubs');
    }

    return await res.json();
  }

  async followHub(city: string, token: string): Promise<HubFollowResponse> {
    const res = await fetch('/api/v1/community/hubs/follow', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ city }),
    });

    if (!res.ok) {
      throw new Error('Failed to follow hub');
    }

    return await res.json();
  }

  async unfollowHub(city: string, token: string): Promise<HubFollowResponse> {
    const res = await fetch('/api/v1/community/hubs/unfollow', {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({ city }),
    });

    if (!res.ok) {
      throw new Error('Failed to unfollow hub');
    }

    return await res.json();
  }

  async moderatePost(
    postId: string,
    action: 'HIDE' | 'UNHIDE' | 'DELETE',
    reason: string,
    token: string,
  ): Promise<{ id: string; status: string; action: string; moderatedAt: string }> {
    const res = await fetch(`/api/v1/admin/community/posts/${postId}/moderate`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify({ action, reason } satisfies ModerateCommunityPostInput),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to moderate post: ${res.statusText}`);
    }

    return await res.json();
  }
}

export const communityFrontendService = new CommunityService();
