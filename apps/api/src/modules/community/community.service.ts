import { type CommunityPostType, EventRsvpStatus } from '@creatorconnect/database';
import {
  CommunityRepository,
  communityRepository,
  type ListPostsOptions,
  type ListEventsOptions,
  type ListCommentsOptions,
} from './community.repository.js';
import { CommunityModerationUnauthorizedError } from '../../errors/app-error.js';

export class CommunityService {
  constructor(private readonly repo: CommunityRepository = communityRepository) {}

  async listPosts(options: ListPostsOptions) {
    return await this.repo.listPosts(options);
  }

  async getPostById(
    id: string,
    currentUserId?: string,
    _userRoles: string[] = [],
    canViewHidden = false,
  ) {
    return await this.repo.getPostById(id, currentUserId, canViewHidden);
  }

  async createPost(
    authorId: string,
    data: {
      title: string;
      body: string;
      type?: CommunityPostType;
      city?: string;
      tags?: string[];
      linkedAssignmentId?: string | null;
      linkedEventId?: string | null;
    },
  ) {
    return await this.repo.createPost({
      authorId,
      ...data,
    });
  }

  async applaudPost(postId: string, userId: string) {
    return await this.repo.applaudPost(postId, userId);
  }

  async createComment(postId: string, authorId: string, content: string) {
    return await this.repo.createComment(postId, authorId, content);
  }

  async listComments(postId: string, options: ListCommentsOptions) {
    return await this.repo.listComments(postId, options);
  }

  async listEvents(options: ListEventsOptions) {
    return await this.repo.listEvents(options);
  }

  async getEventById(id: string, currentUserId?: string) {
    return await this.repo.getEventById(id, currentUserId);
  }

  async createEvent(
    organizerId: string,
    data: {
      title: string;
      description: string;
      city: string;
      venue: string;
      eventDate: string;
      endDate?: string | null | undefined;
      capacity?: number | null | undefined;
      isOfficial?: boolean | undefined;
    },
  ) {
    const eventDate = new Date(data.eventDate);
    const endDate = data.endDate ? new Date(data.endDate) : null;

    return await this.repo.createEvent({
      organizerId,
      title: data.title,
      description: data.description,
      city: data.city,
      venue: data.venue,
      eventDate,
      endDate,
      capacity: data.capacity ?? null,
      isOfficial: data.isOfficial ?? false,
    });
  }

  async rsvpEvent(
    eventId: string,
    userId: string,
    status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED',
  ) {
    const targetStatus =
      status === 'CANCELLED' ? EventRsvpStatus.CANCELLED : EventRsvpStatus.CONFIRMED;
    return await this.repo.rsvpEvent(eventId, userId, targetStatus);
  }

  async followHub(userId: string, city: string) {
    return await this.repo.followHub(userId, city);
  }

  async unfollowHub(userId: string, city: string) {
    return await this.repo.unfollowHub(userId, city);
  }

  async getUserFollowedHubs(userId: string) {
    return await this.repo.getUserFollowedHubs(userId);
  }

  async moderatePost(
    postId: string,
    moderatorId: string,
    _userRoles: string[],
    data: { action: 'HIDE' | 'UNHIDE' | 'DELETE'; reason: string },
    isAuthorizedModerator = false,
  ) {
    if (!isAuthorizedModerator) {
      throw new CommunityModerationUnauthorizedError();
    }
    return await this.repo.moderatePost(postId, moderatorId, data.action, data.reason);
  }
}

export const communityService = new CommunityService();
