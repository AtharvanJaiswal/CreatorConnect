import { getPrismaClient } from '@creatorconnect/database';
import type {
  SearchAssignmentsQuery,
  SearchAssignmentsResponse,
  SearchCreatorsQuery,
  SearchCreatorsResponse,
} from '@creatorconnect/contracts';
import {
  discoveryRepository,
  DiscoveryRepository,
  type KeysetCursor,
} from './discovery.repository.js';
import { assignmentsService } from '../assignments/assignments.service.js';

export class DiscoveryService {
  constructor(
    private repo: DiscoveryRepository = discoveryRepository,
    private prisma = getPrismaClient(),
  ) {}

  async searchAssignments(query: SearchAssignmentsQuery): Promise<SearchAssignmentsResponse> {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const cursor = this.decodeCursor(query.cursor);

    const rows = await this.repo.searchAssignments({
      query: query.q,
      categoryId: query.categoryId,
      budgetMin: query.budgetMin,
      budgetMax: query.budgetMax,
      isRemote: query.isRemote,
      location: query.location,
      cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    // Fetch requirements for returned assignments
    const assignmentIds = items.map((i) => i.id);
    const requirements = await this.prisma.assignmentRequirement.findMany({
      where: { assignmentId: { in: assignmentIds } },
    });
    const reqMap = new Map<string, any[]>();
    for (const req of requirements) {
      if (!reqMap.has(req.assignmentId)) reqMap.set(req.assignmentId, []);
      reqMap.get(req.assignmentId)!.push(req);
    }

    const mappedItems = items.map((a) => {
      a.requirements = reqMap.get(a.id) || [];
      return assignmentsService.mapAssignment(a);
    });

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor(
        last.computed_rank ?? 0,
        last.created_at.toISOString(),
        last.id,
      );
    }

    return {
      items: mappedItems,
      nextCursor,
      hasMore,
    };
  }

  async searchCreators(query: SearchCreatorsQuery): Promise<SearchCreatorsResponse> {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const cursor = this.decodeCursor(query.cursor);

    const rows = await this.repo.searchCreators({
      query: query.q,
      categoryId: query.categoryId,
      skillId: query.skillId,
      locationCountry: query.locationCountry,
      locationCity: query.locationCity,
      isRemote: query.isRemote,
      cursor,
      limit,
    });

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    // Fetch categories for returned creator profiles
    const profileIds = items.map((i) => i.id);
    const profileCats = await this.prisma.creatorProfileCategory.findMany({
      where: { creatorProfileId: { in: profileIds } },
      include: { category: true },
    });
    const catMap = new Map<string, any[]>();
    for (const pc of profileCats) {
      if (!catMap.has(pc.creatorProfileId)) catMap.set(pc.creatorProfileId, []);
      catMap.get(pc.creatorProfileId)!.push(pc);
    }

    const mappedItems = items.map((cp) => ({
      id: cp.id,
      userId: cp.user_id,
      tagline: cp.tagline,
      bio: cp.bio,
      locationCountry: cp.location_country,
      locationCity: cp.location_city,
      isRemote: cp.is_remote,
      startingRate: cp.starting_rate,
      currency: cp.currency,
      visibility: cp.visibility,
      isVerified: cp.is_verified,
      socialLinks: cp.social_links,
      completionScore: cp.completion_score,
      categories: (catMap.get(cp.id) || []).map((c) => ({
        id: c.category.id,
        slug: c.category.slug,
        name: c.category.name,
      })),
      createdAt: cp.created_at.toISOString(),
      updatedAt: cp.updated_at.toISOString(),
    }));

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor(
        last.computed_rank ?? 0,
        last.created_at.toISOString(),
        last.id,
      );
    }

    return {
      items: mappedItems,
      nextCursor,
      hasMore,
    };
  }

  encodeCursor(computedRank: number, createdAt: string, id: string): string {
    const payload = JSON.stringify([computedRank, createdAt, id]);
    return Buffer.from(payload).toString('base64url');
  }

  decodeCursor(cursorStr?: string): KeysetCursor | undefined {
    if (!cursorStr) return undefined;
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf-8');
      const [computedRank, createdAt, id] = JSON.parse(json);
      if (
        typeof computedRank === 'number' &&
        typeof createdAt === 'string' &&
        typeof id === 'string'
      ) {
        return { computedRank, createdAt, id };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}

export const discoveryService = new DiscoveryService();
