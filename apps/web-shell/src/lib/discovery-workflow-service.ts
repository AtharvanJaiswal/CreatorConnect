import type {
  SearchCreatorsQuery,
  SearchCreatorsResponse,
  CategoryResponse,
  SkillResponse,
} from '@creatorconnect/contracts';
export {
  rankAndSortCreators,
  scoreCreatorCandidate,
  DEFAULT_MATCHING_WEIGHTS,
  type CreatorCandidate,
  type MatchingQueryContext,
  type MatchExplanation,
  type CreatorMatchResult,
} from '@creatorconnect/utils';

export interface DiscoveryFilterState {
  q?: string | undefined;
  categoryId?: string | undefined;
  skillId?: string | undefined;
  skillIds?: string[] | undefined;
  minRating?: number | undefined;
  minCompletedProjects?: number | undefined;
  rateMin?: number | undefined;
  rateMax?: number | undefined;
  isVerified?: boolean | undefined;
  isAvailable?: boolean | undefined;
  isRemote?: boolean | undefined;
  locationCountry?: string | undefined;
  sortBy?:
    ('relevance' | 'rating' | 'completedProjects' | 'rateAsc' | 'rateDesc' | 'newest') | undefined;
  matchProjectId?: string | undefined;
}

/**
 * Builds API query parameters from discovery filter state.
 */
export function buildFilterQuery(
  filters: DiscoveryFilterState,
  cursor?: string | undefined,
  limit: number = 20,
): SearchCreatorsQuery {
  const query: SearchCreatorsQuery = {
    limit,
  };

  if (cursor) {
    query.cursor = cursor;
  }

  if (filters.q && filters.q.trim().length > 0) {
    query.q = filters.q.trim();
  }
  if (filters.categoryId) {
    query.categoryId = filters.categoryId;
  }
  if (filters.skillId) {
    query.skillId = filters.skillId;
  }
  if (filters.skillIds && filters.skillIds.length > 0) {
    query.skillIds = filters.skillIds;
  }
  if (filters.minRating && filters.minRating > 0) {
    query.minRating = filters.minRating;
  }
  if (filters.minCompletedProjects && filters.minCompletedProjects > 0) {
    query.minCompletedProjects = filters.minCompletedProjects;
  }
  if (filters.rateMin !== undefined && filters.rateMin > 0) {
    query.rateMin = filters.rateMin;
  }
  if (filters.rateMax !== undefined && filters.rateMax > 0) {
    query.rateMax = filters.rateMax;
  }
  if (filters.isVerified !== undefined) {
    query.isVerified = filters.isVerified;
  }
  if (filters.isAvailable !== undefined) {
    query.isAvailable = filters.isAvailable;
  }
  if (filters.isRemote !== undefined) {
    query.isRemote = filters.isRemote;
  }
  if (filters.locationCountry) {
    query.locationCountry = filters.locationCountry;
  }
  if (filters.sortBy) {
    query.sortBy = filters.sortBy;
  }
  if (filters.matchProjectId) {
    query.matchProjectId = filters.matchProjectId;
  }

  return query;
}

/**
 * Formats match score into human-readable badge text.
 */
export function formatMatchScore(percentage: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  return `${clamped}% Match`;
}

/**
 * Returns Stitch-aligned badge colors for match explanation types.
 */
export function getExplanationBadgeColor(type: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (type) {
    case 'skill':
      return { bg: '#EBF3FE', text: '#1B66C9', border: '#A6CCF7' };
    case 'budget':
      return { bg: '#E6F4EA', text: '#2E9E6B', border: '#B6E09B' };
    case 'rating':
      return { bg: '#FFF6D9', text: '#9B6C00', border: '#FFD64A' };
    case 'experience':
      return { bg: '#F3E8FF', text: '#6B21A8', border: '#D8B4FE' };
    case 'verification':
      return { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' };
    case 'availability':
      return { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' };
    default:
      return { bg: '#FAF6EF', text: '#6F675E', border: '#E7E0D5' };
  }
}

/**
 * API Client: Search creators with filters and explainable matching.
 */
export async function searchCreators(
  query: SearchCreatorsQuery,
  accessToken?: string | null,
): Promise<SearchCreatorsResponse> {
  const params = new URLSearchParams();

  if (query.q) params.set('q', query.q);
  if (query.categoryId) params.set('categoryId', query.categoryId);
  if (query.skillId) params.set('skillId', query.skillId);
  if (query.skillIds && query.skillIds.length > 0) {
    query.skillIds.forEach((s) => params.append('skillIds', s));
  }
  if (query.minRating) params.set('minRating', String(query.minRating));
  if (query.minCompletedProjects)
    params.set('minCompletedProjects', String(query.minCompletedProjects));
  if (query.rateMin !== undefined) params.set('rateMin', String(query.rateMin));
  if (query.rateMax !== undefined) params.set('rateMax', String(query.rateMax));
  if (query.isVerified !== undefined) params.set('isVerified', String(query.isVerified));
  if (query.isAvailable !== undefined) params.set('isAvailable', String(query.isAvailable));
  if (query.isRemote !== undefined) params.set('isRemote', String(query.isRemote));
  if (query.locationCountry) params.set('locationCountry', query.locationCountry);
  if (query.sortBy) params.set('sortBy', query.sortBy);
  if (query.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query.matchProjectId) params.set('matchProjectId', query.matchProjectId);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`/api/v1/discovery/creators?${params.toString()}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || 'Failed to search creators');
  }

  return res.json();
}

/**
 * API Client: Fetch active taxonomy categories.
 */
export async function fetchCategories(): Promise<CategoryResponse[]> {
  const res = await fetch('/api/v1/discovery/categories');
  if (!res.ok) {
    throw new Error('Failed to load categories');
  }
  return res.json();
}

/**
 * API Client: Fetch active taxonomy skills.
 */
export async function fetchSkills(): Promise<SkillResponse[]> {
  const res = await fetch('/api/v1/discovery/skills');
  if (!res.ok) {
    throw new Error('Failed to load skills');
  }
  return res.json();
}
