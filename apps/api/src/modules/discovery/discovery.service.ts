import { getPrismaClient } from '@creatorconnect/database';
import type {
  SearchAssignmentsQuery,
  SearchAssignmentsResponse,
  SearchCreatorsQuery,
  SearchCreatorsResponse,
  DiscoveredCreatorResponse,
} from '@creatorconnect/contracts';
import {
  rankAndSortCreators,
  roundRatingForDisplay,
  type CreatorCandidate,
  type MatchingQueryContext,
  type MatchingSortOption,
} from '@creatorconnect/utils';
import { ProjectNotFoundError, NotProjectParticipantError } from '../../errors/app-error.js';
import {
  discoveryRepository,
  DiscoveryRepository,
  type KeysetCursor,
} from './discovery.repository.js';
import { assignmentsService } from '../assignments/assignments.service.js';

export interface RankedCursor {
  offset: number;
  total: number;
  lastId: string;
}

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

  async searchCreators(
    query: SearchCreatorsQuery,
    requestingUserId?: string,
  ): Promise<SearchCreatorsResponse> {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    // 1. Authoritative Project Brief Context Verification
    let matchProjectContext: { id: string; title: string } | undefined = undefined;
    let projectBudget: number | undefined = undefined;

    if (query.matchProjectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: query.matchProjectId },
      });

      if (!project) {
        throw new ProjectNotFoundError('Project specified for matching was not found.');
      }

      // Enforce participant or admin authorization for private project briefs
      if (
        requestingUserId &&
        project.clientId !== requestingUserId &&
        project.talentId !== requestingUserId
      ) {
        const userRoles = await this.prisma.userRole.findMany({
          where: { userId: requestingUserId },
          include: { role: true },
        });
        const isAdmin = userRoles.some((r) => r.role.name === 'ADMIN');
        if (!isAdmin) {
          throw new NotProjectParticipantError(
            'Not authorized to access project brief for matching.',
          );
        }
      }

      matchProjectContext = {
        id: project.id,
        title: project.title,
      };

      if (project.totalAmount && project.totalAmount > 0) {
        projectBudget = project.totalAmount;
      }
    }

    // 2. Fetch candidate creator records from database
    const fetchLimit = Math.max(limit * 4, 80);
    const rows = await this.repo.searchCreators({
      query: query.q,
      categoryId: query.categoryId,
      skillId: query.skillId,
      skillIds: query.skillIds,
      locationCountry: query.locationCountry,
      locationCity: query.locationCity,
      isRemote: query.isRemote,
      rateMin: query.rateMin,
      rateMax: query.rateMax,
      isVerified: query.isVerified,
      limit: fetchLimit,
    });

    if (rows.length === 0) {
      return {
        items: [],
        nextCursor: null,
        hasMore: false,
        totalMatches: 0,
        ...(matchProjectContext ? { matchProjectContext } : {}),
      };
    }

    // 3. Batch load related relations across candidates (Zero N+1 queries)
    const profileIds = rows.map((r) => r.id);
    const userIds = rows.map((r) => r.user_id);

    const [
      profileCategories,
      userSkills,
      professionalProfiles,
      reviewAggregates,
      projectAggregates,
    ] = await Promise.all([
      this.prisma.creatorProfileCategory.findMany({
        where: { creatorProfileId: { in: profileIds } },
        include: { category: true },
      }),
      this.prisma.userSkill.findMany({
        where: { userId: { in: userIds } },
        include: { skill: true },
      }),
      this.prisma.professionalProfile.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, isAvailable: true },
      }),
      this.prisma.review.groupBy({
        by: ['revieweeId'],
        where: {
          revieweeId: { in: userIds },
          status: 'PUBLISHED',
        },
        _count: { id: true },
        _avg: { rating: true },
      }),
      this.prisma.project.groupBy({
        by: ['talentId'],
        where: {
          talentId: { in: userIds },
          status: 'COMPLETED',
        },
        _count: { id: true },
      }),
    ]);

    // Build indexing lookup maps
    const catMap = new Map<string, Array<{ id: string; slug: string; name: string }>>();
    for (const pc of profileCategories) {
      if (!catMap.has(pc.creatorProfileId)) catMap.set(pc.creatorProfileId, []);
      catMap.get(pc.creatorProfileId)!.push({
        id: pc.category.id,
        slug: pc.category.slug,
        name: pc.category.name,
      });
    }

    const skillMap = new Map<
      string,
      Array<{ id: string; slug: string; name: string; proficiency?: string }>
    >();
    for (const us of userSkills) {
      if (!skillMap.has(us.userId)) skillMap.set(us.userId, []);
      skillMap.get(us.userId)!.push({
        id: us.skill.id,
        slug: us.skill.slug,
        name: us.skill.name,
        proficiency: us.proficiency,
      });
    }

    const profMap = new Map<string, { isAvailable: boolean }>();
    for (const pp of professionalProfiles) {
      profMap.set(pp.userId, { isAvailable: pp.isAvailable });
    }

    const reviewMap = new Map<string, { count: number; avgRating: number | null }>();
    for (const rev of reviewAggregates) {
      const avg = rev._avg.rating !== null ? roundRatingForDisplay(rev._avg.rating, 1) : null;
      reviewMap.set(rev.revieweeId, { count: rev._count.id, avgRating: avg });
    }

    const projectCountMap = new Map<string, number>();
    for (const pr of projectAggregates) {
      if (pr.talentId) {
        projectCountMap.set(pr.talentId, pr._count.id);
      }
    }

    // 4. Map candidate records into pure CreatorCandidate domain entities
    const candidateEntities: CreatorCandidate[] = rows.map((cp) => {
      const cats = catMap.get(cp.id) || [];
      const skills = skillMap.get(cp.user_id) || [];
      const prof = profMap.get(cp.user_id);
      const rev = reviewMap.get(cp.user_id);
      const completedCount = projectCountMap.get(cp.user_id) || 0;

      const first = cp.first_name || '';
      const last = cp.last_name || '';
      const displayName = `${first} ${last}`.trim() || 'Creator';

      return {
        creatorId: cp.id,
        userId: cp.user_id,
        displayName,
        tagline: cp.tagline,
        bio: cp.bio,
        skillIds: skills.map((s) => s.id),
        skillNames: skills.map((s) => s.name),
        categoryIds: cats.map((c) => c.id),
        categoryNames: cats.map((c) => c.name),
        startingRate: cp.starting_rate,
        currency: cp.currency || 'INR',
        averageRating: rev?.avgRating ?? null,
        eligibleReviewCount: rev?.count ?? 0,
        completedProjectsCount: completedCount,
        isAvailable: prof?.isAvailable ?? true,
        isVerified: cp.is_verified ?? false,
        locationCountry: cp.location_country,
        locationCity: cp.location_city,
        isRemote: cp.is_remote ?? true,
        createdAt: cp.created_at.toISOString(),
      };
    });

    // 5. Build Matching Query Context
    const matchingContext: MatchingQueryContext = {
      q: query.q,
      requiredSkillIds:
        query.skillIds && query.skillIds.length > 0
          ? query.skillIds
          : query.skillId
            ? [query.skillId]
            : undefined,
      preferredCategoryIds: query.categoryId ? [query.categoryId] : undefined,
      budgetMin: query.rateMin,
      budgetMax: query.rateMax ?? projectBudget,
      minRating: query.minRating,
      minCompletedProjects: query.minCompletedProjects,
      requireVerified: query.isVerified,
      requireAvailable: query.isAvailable,
      isRemote: query.isRemote,
      locationCountry: query.locationCountry,
      locationCity: query.locationCity,
    };

    // 6. Execute Canonical Deterministic Ranking & Scoring
    const rankedResults = rankAndSortCreators(candidateEntities, matchingContext, {
      sortBy: (query.sortBy as MatchingSortOption) || 'relevance',
      sortOrder: query.sortOrder || 'desc',
    });

    // Filter to eligible candidates
    const eligibleResults = rankedResults.filter((r) => r.isEligible);

    // 7. Keyset / Offset Pagination
    const rankedCursor = this.decodeRankedCursor(query.cursor);
    const offset = rankedCursor ? rankedCursor.offset : 0;
    const pageItems = eligibleResults.slice(offset, offset + limit);
    const hasMore = offset + limit < eligibleResults.length;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0 && pageItems[pageItems.length - 1]) {
      const lastItem = pageItems[pageItems.length - 1]!;
      nextCursor = this.encodeRankedCursor(
        offset + limit,
        eligibleResults.length,
        lastItem.candidate.creatorId,
      );
    }

    // Map to API response DTOs
    const rowMap = new Map<string, any>();
    for (const r of rows) {
      rowMap.set(r.id, r);
    }

    const mappedItems: DiscoveredCreatorResponse[] = pageItems.map((res) => {
      const raw = rowMap.get(res.candidate.creatorId);
      const cats = catMap.get(res.candidate.creatorId) || [];
      const skills = skillMap.get(res.candidate.userId) || [];

      return {
        id: res.candidate.creatorId,
        userId: res.candidate.userId,
        displayName: res.candidate.displayName,
        avatarUrl: raw?.avatar_url ?? null,
        tagline: res.candidate.tagline ?? null,
        bio: res.candidate.bio ?? null,
        locationCountry: res.candidate.locationCountry ?? null,
        locationCity: res.candidate.locationCity ?? null,
        isRemote: res.candidate.isRemote,
        startingRate: res.candidate.startingRate,
        currency: res.candidate.currency,
        visibility: raw?.visibility || 'PUBLIC',
        isVerified: res.candidate.isVerified,
        isAvailable: res.candidate.isAvailable,
        completionScore: raw?.completion_score ?? 0,
        averageRating: res.candidate.averageRating,
        eligibleReviewCount: res.candidate.eligibleReviewCount,
        completedProjectsCount: res.candidate.completedProjectsCount,
        categories: cats,
        skills,
        matchScore: res.matchScore,
        matchPercentage: res.matchPercentage,
        matchExplanations: res.explanations.map((exp) => ({
          type: exp.type,
          summary: exp.summary,
          ...(exp.detail ? { detail: exp.detail } : {}),
          ...(exp.contributionPercent !== undefined
            ? { contributionPercent: exp.contributionPercent }
            : {}),
        })),
        createdAt: raw?.created_at.toISOString() || res.candidate.createdAt,
        updatedAt: raw?.updated_at.toISOString() || res.candidate.createdAt,
      };
    });

    return {
      items: mappedItems,
      nextCursor,
      hasMore,
      totalMatches: eligibleResults.length,
      ...(matchProjectContext ? { matchProjectContext } : {}),
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
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        typeof computedRank === 'number' &&
        !Number.isNaN(computedRank) &&
        typeof createdAt === 'string' &&
        !Number.isNaN(Date.parse(createdAt)) &&
        typeof id === 'string' &&
        uuidRegex.test(id)
      ) {
        return { computedRank, createdAt, id };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  encodeRankedCursor(offset: number, total: number, lastId: string): string {
    const payload = JSON.stringify({ offset, total, lastId });
    return Buffer.from(payload).toString('base64url');
  }

  decodeRankedCursor(cursorStr?: string): RankedCursor | undefined {
    if (!cursorStr) return undefined;
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf-8');
      const parsed = JSON.parse(json);
      if (
        typeof parsed.offset === 'number' &&
        typeof parsed.total === 'number' &&
        typeof parsed.lastId === 'string'
      ) {
        return parsed as RankedCursor;
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}

export const discoveryService = new DiscoveryService();
