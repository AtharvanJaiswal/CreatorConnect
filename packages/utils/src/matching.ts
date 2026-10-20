/**
 * CreatorConnect — Phase 10: Canonical Deterministic Creator Matching & Ranking Engine
 * Pure domain logic: zero Prisma, zero HTTP, zero network dependencies.
 */

export interface CreatorCandidate {
  creatorId: string;
  userId: string;
  displayName: string;
  tagline?: string | null;
  bio?: string | null;
  skillIds: string[];
  skillNames?: string[];
  categoryIds: string[];
  categoryNames?: string[];
  startingRate: number | null;
  currency: string;
  averageRating: number | null; // Authoritative Phase 9 arithmetic mean (1.0 - 5.0) or null
  eligibleReviewCount: number;
  completedProjectsCount: number; // Verified completed projects count
  isAvailable: boolean;
  isVerified: boolean;
  locationCountry?: string | null;
  locationCity?: string | null;
  isRemote: boolean;
  createdAt: string; // ISO string for chronological tie-breaking
}

export interface MatchingQueryContext {
  q?: string | undefined;
  requiredSkillIds?: string[] | undefined;
  preferredCategoryIds?: string[] | undefined;
  budgetMin?: number | null | undefined;
  budgetMax?: number | null | undefined;
  minRating?: number | null | undefined;
  minCompletedProjects?: number | null | undefined;
  requireVerified?: boolean | undefined;
  requireAvailable?: boolean | undefined;
  isRemote?: boolean | undefined;
  locationCountry?: string | undefined;
  locationCity?: string | undefined;
}

export interface MatchingWeightsPolicy {
  skillOverlap: number; // default 0.40 (40%)
  categoryRelevance: number; // default 0.25 (25%)
  budgetCompatibility: number; // default 0.15 (15%)
  publishedReputation: number; // default 0.10 (10%)
  completedProjects: number; // default 0.10 (10%)
}

export const DEFAULT_MATCHING_WEIGHTS: Readonly<MatchingWeightsPolicy> = Object.freeze({
  skillOverlap: 0.4,
  categoryRelevance: 0.25,
  budgetCompatibility: 0.15,
  publishedReputation: 0.1,
  completedProjects: 0.1,
});

export interface MatchExplanation {
  type: 'skill' | 'category' | 'budget' | 'rating' | 'experience' | 'verification' | 'availability';
  summary: string;
  detail?: string | undefined;
  contributionPercent?: number | undefined;
}

export interface CreatorMatchResult {
  candidate: CreatorCandidate;
  isEligible: boolean;
  matchScore: number; // [0, 1] bounded relevance score
  matchPercentage: number; // [0, 100] rounded integer for UI display
  activeFeatures: string[];
  normalizedWeights: Record<string, number>;
  featureScores: Record<string, number>;
  explanations: MatchExplanation[];
}

export type MatchingSortOption =
  'relevance' | 'rating' | 'completedProjects' | 'rateAsc' | 'rateDesc' | 'newest';

/**
 * Calculates Jaccard Similarity J(A, B) = |A ∩ B| / |A ∪ B|.
 * Bounded strictly in [0, 1].
 */
export function calculateJaccardSimilarity(
  setA: readonly string[],
  setB: readonly string[],
): number {
  if (setA.length === 0 && setB.length === 0) {
    return 0; // Empty set query: no artificial reward
  }
  const a = new Set(setA);
  const b = new Set(setB);

  let intersectionCount = 0;
  for (const item of a) {
    if (b.has(item)) {
      intersectionCount++;
    }
  }

  const unionSize = new Set([...setA, ...setB]).size;
  if (unionSize === 0) return 0;

  return intersectionCount / unionSize;
}

/**
 * Normalizes published rating (1 to 5) onto a [0, 1] scale.
 * s_rating = (r - 1) / 4
 * Returns null if rating is null/unrated.
 */
export function normalizeRating(rating: number | null): number | null {
  if (rating === null || Number.isNaN(rating)) return null;
  const clamped = Math.max(1, Math.min(5, rating));
  return (clamped - 1) / 4;
}

/**
 * Normalizes completed projects count against a reasonable benchmark (default 10).
 * Bounded strictly in [0, 1].
 */
export function normalizeCompletedProjects(count: number, benchmark: number = 10): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(1.0, count / Math.max(1, benchmark));
}

/**
 * Calculates budget compatibility score in [0, 1].
 * Perfect match (1.0) if rate is within [budgetMin, budgetMax].
 * Smooth linear falloff if within 50% tolerance beyond bounds; 0 if completely out of budget.
 */
export function calculateBudgetScore(
  startingRate: number | null,
  budgetMin?: number | null,
  budgetMax?: number | null,
): number | null {
  if (startingRate === null || (!budgetMin && !budgetMax)) {
    return null; // Omitted if no rate or no budget context
  }

  const rate = Math.max(0, startingRate);
  const min = budgetMin !== undefined && budgetMin !== null && budgetMin > 0 ? budgetMin : 0;
  const max = budgetMax !== undefined && budgetMax !== null && budgetMax > 0 ? budgetMax : Infinity;

  if (rate >= min && rate <= max) {
    return 1.0;
  }

  if (rate > max && Number.isFinite(max)) {
    const tolerance = max * 0.5;
    const overage = rate - max;
    return Math.max(0, 1.0 - overage / tolerance);
  }

  if (rate < min && min > 0) {
    const tolerance = min * 0.5;
    const underage = min - rate;
    return Math.max(0, 1.0 - underage / tolerance);
  }

  return 1.0;
}

/**
 * Checks hard eligibility constraints.
 */
export function evaluateEligibility(
  candidate: CreatorCandidate,
  query: MatchingQueryContext,
): boolean {
  if (query.requireVerified && !candidate.isVerified) {
    return false;
  }

  if (query.requireAvailable && !candidate.isAvailable) {
    return false;
  }

  if (query.minRating !== undefined && query.minRating !== null && query.minRating > 0) {
    if (candidate.averageRating === null || candidate.averageRating < query.minRating) {
      return false;
    }
  }

  if (
    query.minCompletedProjects !== undefined &&
    query.minCompletedProjects !== null &&
    query.minCompletedProjects > 0
  ) {
    if (candidate.completedProjectsCount < query.minCompletedProjects) {
      return false;
    }
  }

  if (query.isRemote === false && candidate.isRemote === false) {
    if (
      query.locationCountry &&
      candidate.locationCountry &&
      query.locationCountry.toUpperCase() !== candidate.locationCountry.toUpperCase()
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Scores a creator candidate deterministically against a query context.
 */
export function scoreCreatorCandidate(
  candidate: CreatorCandidate,
  query: MatchingQueryContext,
  weightsPolicy: Partial<MatchingWeightsPolicy> = {},
): CreatorMatchResult {
  const policy: MatchingWeightsPolicy = {
    ...DEFAULT_MATCHING_WEIGHTS,
    ...weightsPolicy,
  };

  const isEligible = evaluateEligibility(candidate, query);
  if (!isEligible) {
    return {
      candidate,
      isEligible: false,
      matchScore: 0,
      matchPercentage: 0,
      activeFeatures: [],
      normalizedWeights: {},
      featureScores: {},
      explanations: [],
    };
  }

  const activeFeatures: string[] = [];
  const rawScores: Record<string, number> = {};
  const activeWeights: Record<string, number> = {};
  const explanations: MatchExplanation[] = [];

  // 1. Skill Overlap Feature
  if (query.requiredSkillIds && query.requiredSkillIds.length > 0) {
    const jaccard = calculateJaccardSimilarity(candidate.skillIds, query.requiredSkillIds);
    const querySkillSet = new Set(query.requiredSkillIds);
    const matchedSkillCount = candidate.skillIds.filter((s) => querySkillSet.has(s)).length;
    const totalRequired = query.requiredSkillIds.length;

    activeFeatures.push('skillOverlap');
    rawScores.skillOverlap = jaccard;
    activeWeights.skillOverlap = Math.max(0, policy.skillOverlap);

    const matchedNames = candidate.skillNames
      ? candidate.skillNames.slice(0, 3).join(', ')
      : undefined;

    explanations.push({
      type: 'skill',
      summary: `Matches ${matchedSkillCount} of ${totalRequired} required skills`,
      detail: matchedNames ? `Skills: ${matchedNames}` : undefined,
    });
  }

  // 2. Category Relevance Feature
  if (query.preferredCategoryIds && query.preferredCategoryIds.length > 0) {
    const queryCatSet = new Set(query.preferredCategoryIds);
    const matchedCatCount = candidate.categoryIds.filter((c) => queryCatSet.has(c)).length;
    const catScore = matchedCatCount > 0 ? matchedCatCount / query.preferredCategoryIds.length : 0;

    activeFeatures.push('categoryRelevance');
    rawScores.categoryRelevance = Math.min(1.0, catScore);
    activeWeights.categoryRelevance = Math.max(0, policy.categoryRelevance);

    if (matchedCatCount > 0) {
      explanations.push({
        type: 'category',
        summary: `Specializes in ${candidate.categoryNames?.[0] || 'requested category'}`,
      });
    }
  }

  // 3. Budget Compatibility Feature
  const budgetScore = calculateBudgetScore(
    candidate.startingRate,
    query.budgetMin,
    query.budgetMax,
  );
  if (budgetScore !== null) {
    activeFeatures.push('budgetCompatibility');
    rawScores.budgetCompatibility = budgetScore;
    activeWeights.budgetCompatibility = Math.max(0, policy.budgetCompatibility);

    if (budgetScore >= 0.99) {
      explanations.push({
        type: 'budget',
        summary: 'Within specified budget range',
        detail: `Starting rate: ₹${candidate.startingRate?.toLocaleString('en-IN') || 'Negotiable'}`,
      });
    } else if (budgetScore > 0) {
      explanations.push({
        type: 'budget',
        summary: 'Competitive budget alignment',
      });
    }
  }

  // 4. Published Reputation Feature (Phase 9 Authoritative Rating)
  const ratingNorm = normalizeRating(candidate.averageRating);
  if (ratingNorm !== null && candidate.eligibleReviewCount > 0) {
    activeFeatures.push('publishedReputation');
    rawScores.publishedReputation = ratingNorm;
    activeWeights.publishedReputation = Math.max(0, policy.publishedReputation);

    explanations.push({
      type: 'rating',
      summary: `Rated ${candidate.averageRating?.toFixed(1)}/5.0 from ${candidate.eligibleReviewCount} verified review${candidate.eligibleReviewCount === 1 ? '' : 's'}`,
    });
  }

  // 5. Completed Projects Relevance Feature
  if (candidate.completedProjectsCount > 0 || (query.minCompletedProjects ?? 0) > 0) {
    const projScore = normalizeCompletedProjects(candidate.completedProjectsCount);
    activeFeatures.push('completedProjects');
    rawScores.completedProjects = projScore;
    activeWeights.completedProjects = Math.max(0, policy.completedProjects);

    if (candidate.completedProjectsCount > 0) {
      explanations.push({
        type: 'experience',
        summary: `${candidate.completedProjectsCount} verified completed project${candidate.completedProjectsCount === 1 ? '' : 's'}`,
      });
    }
  }

  // Non-scored factual highlights
  if (candidate.isVerified) {
    explanations.push({
      type: 'verification',
      summary: 'Verified creator profile',
    });
  }

  if (candidate.isAvailable) {
    explanations.push({
      type: 'availability',
      summary: 'Available for immediate booking',
    });
  }

  // Calculate Normalized Weights: w'_i = w_i / sum(w_j)
  const sumWeights = activeFeatures.reduce((acc, feat) => acc + (activeWeights[feat] ?? 0), 0);
  const normalizedWeights: Record<string, number> = {};

  let finalScore = 0;
  if (sumWeights > 0) {
    for (const feat of activeFeatures) {
      const wPrime = (activeWeights[feat] ?? 0) / sumWeights;
      normalizedWeights[feat] = Number(wPrime.toFixed(4));
      finalScore += wPrime * (rawScores[feat] ?? 0);
    }
  } else {
    finalScore = 0;
  }

  // Bound score strictly in [0, 1]
  const matchScore = Math.max(0, Math.min(1.0, Number(finalScore.toFixed(4))));
  const matchPercentage = Math.round(matchScore * 100);

  // Attach contribution percentage to matching explanations
  for (const exp of explanations) {
    let key: string | undefined;
    if (exp.type === 'skill') key = 'skillOverlap';
    else if (exp.type === 'category') key = 'categoryRelevance';
    else if (exp.type === 'budget') key = 'budgetCompatibility';
    else if (exp.type === 'rating') key = 'publishedReputation';
    else if (exp.type === 'experience') key = 'completedProjects';

    if (key && normalizedWeights[key] !== undefined && rawScores[key] !== undefined) {
      const w = normalizedWeights[key]!;
      const s = rawScores[key]!;
      const contribution = w * s;
      exp.contributionPercent = Math.round(contribution * 100);
    }
  }

  return {
    candidate,
    isEligible: true,
    matchScore,
    matchPercentage,
    activeFeatures,
    normalizedWeights,
    featureScores: rawScores,
    explanations,
  };
}

/**
 * Deterministically ranks and sorts a list of creator candidates.
 * Tie-breaking hierarchy:
 * 1. Eligibility (eligible first)
 * 2. Primary sort key
 * 3. Completed projects count DESC
 * 4. Average rating DESC
 * 5. creatorId ASC (UUID string compare) for stable, deterministic ordering.
 */
export function rankAndSortCreators(
  candidates: CreatorCandidate[],
  query: MatchingQueryContext,
  options: {
    sortBy?: MatchingSortOption;
    sortOrder?: 'asc' | 'desc';
    weights?: Partial<MatchingWeightsPolicy>;
  } = {},
): CreatorMatchResult[] {
  const sortBy = options.sortBy || 'relevance';
  const sortOrder = options.sortOrder || 'desc';
  const scored = candidates.map((c) => scoreCreatorCandidate(c, query, options.weights));

  return scored.sort((a, b) => {
    // 1. Ineligible always sorted to the end
    if (a.isEligible && !b.isEligible) return -1;
    if (!a.isEligible && b.isEligible) return 1;

    let primaryDiff = 0;

    switch (sortBy) {
      case 'relevance': {
        primaryDiff = b.matchScore - a.matchScore;
        break;
      }
      case 'rating': {
        const rA = a.candidate.averageRating ?? -1;
        const rB = b.candidate.averageRating ?? -1;
        primaryDiff = sortOrder === 'asc' ? rA - rB : rB - rA;
        break;
      }
      case 'completedProjects': {
        const cA = a.candidate.completedProjectsCount;
        const cB = b.candidate.completedProjectsCount;
        primaryDiff = sortOrder === 'asc' ? cA - cB : cB - cA;
        break;
      }
      case 'rateAsc': {
        const rateA = a.candidate.startingRate ?? Infinity;
        const rateB = b.candidate.startingRate ?? Infinity;
        primaryDiff = rateA - rateB;
        break;
      }
      case 'rateDesc': {
        const rateA = a.candidate.startingRate ?? -1;
        const rateB = b.candidate.startingRate ?? -1;
        primaryDiff = rateB - rateA;
        break;
      }
      case 'newest': {
        const dateA = new Date(a.candidate.createdAt).getTime();
        const dateB = new Date(b.candidate.createdAt).getTime();
        primaryDiff = dateB - dateA;
        break;
      }
      default:
        primaryDiff = b.matchScore - a.matchScore;
    }

    if (Math.abs(primaryDiff) > 0.00001) {
      return primaryDiff;
    }

    // Secondary key: Completed projects count
    const compDiff = b.candidate.completedProjectsCount - a.candidate.completedProjectsCount;
    if (compDiff !== 0) return compDiff;

    // Tertiary key: Average rating
    const ratingDiff = (b.candidate.averageRating ?? 0) - (a.candidate.averageRating ?? 0);
    if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;

    // Deterministic tie-breaker: creatorId
    return a.candidate.creatorId.localeCompare(b.candidate.creatorId);
  });
}
