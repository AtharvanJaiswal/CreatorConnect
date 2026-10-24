/**
 * CreatorConnect — Authoritative Rating & Reputation Algorithm Module
 * Pure, deterministic mathematical calculations for reviews, star distributions,
 * category scores, and completed project counts.
 *
 * Implements Phase 9 Specifications:
 * - Transparent arithmetic mean (no machine learning, no hidden penalties)
 * - Null when review count n = 0 (never 0 stars)
 * - Star distribution counts and percentages summing to 100% when reviews exist
 * - Independent category scores (C_j = sum(c_ij) / |E_j|)
 * - Completed-project derivation from authoritative COMPLETED status
 * - Strict rating domain validation: r_i in {1, 2, 3, 4, 5}
 */

export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface StarDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  [key: number]: number;
}

export interface RatingAggregates {
  totalCount: number;
  averageRating: number | null;
  starCounts: StarDistribution;
  starPercentages: StarDistribution;
}

/**
 * Validates whether a given rating value is a valid 1-to-5 integer rating.
 * Rejects 0, negatives, decimals, strings, NaN, Infinity, and values > 5.
 */
export function isValidRating(r: unknown): r is StarRating {
  return (
    typeof r === 'number' &&
    Number.isInteger(r) &&
    !Number.isNaN(r) &&
    Number.isFinite(r) &&
    r >= 1 &&
    r <= 5
  );
}

/**
 * Strictly asserts that a rating is an integer in {1, 2, 3, 4, 5}.
 * Throws RangeError or TypeError if invalid.
 */
export function assertValidRating(r: unknown): asserts r is StarRating {
  if (typeof r !== 'number' || Number.isNaN(r) || !Number.isFinite(r)) {
    throw new TypeError(`Rating must be a finite number. Received: ${typeof r}`);
  }
  if (!Number.isInteger(r)) {
    throw new RangeError(`Rating must be an integer between 1 and 5. Received decimal: ${r}`);
  }
  if (r < 1 || r > 5) {
    throw new RangeError(`Rating must be between 1 and 5 inclusive. Received: ${r}`);
  }
}

/**
 * Calculates the transparent arithmetic mean of eligible ratings.
 * Formula:
 *   r_bar = null if n = 0
 *   r_bar = sum(r_i) / n if n > 0
 *
 * Preserves full floating-point precision internally.
 */
export function calculateArithmeticMean(ratings: number[]): number | null {
  if (!ratings || ratings.length === 0) {
    return null;
  }

  let sum = 0;
  let count = 0;

  for (const r of ratings) {
    assertValidRating(r);
    sum += r;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return sum / count;
}

/**
 * Rounds a rating for display formatting (default: 1 decimal place).
 * Returns null if the input is null or undefined.
 */
export function roundRatingForDisplay(
  rating: number | null | undefined,
  decimals = 1,
): number | null {
  if (rating === null || rating === undefined || Number.isNaN(rating)) {
    return null;
  }
  const factor = Math.pow(10, decimals);
  return Math.round(rating * factor) / factor;
}

/**
 * Formats a rating for canonical presentation in the UI.
 * Returns formatted single decimal place string (e.g. "4.2") or emptyLabel (default: "Unrated").
 */
export function formatRating(rating: number | null | undefined, emptyLabel = 'Unrated'): string {
  if (rating === null || rating === undefined || Number.isNaN(rating)) {
    return emptyLabel;
  }
  return rating.toFixed(1);
}

/**
 * Counts the occurrences of each star value {1, 2, 3, 4, 5}.
 */
export function calculateStarCounts(ratings: number[]): StarDistribution {
  const counts: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (!ratings || ratings.length === 0) {
    return counts;
  }

  for (const r of ratings) {
    assertValidRating(r);
    counts[r] = (counts[r] || 0) + 1;
  }

  return counts;
}

/**
 * Calculates star distribution percentages.
 * For n > 0: P_s = 100 * (N_s / n)
 * When n = 0: returns 0% for all stars without division by zero.
 * The unrounded sum of P_s equals 100% when n > 0.
 */
export function calculateStarPercentages(
  counts: StarDistribution,
  totalReviews: number,
  round = false,
): StarDistribution {
  if (!totalReviews || totalReviews <= 0) {
    return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  }

  const percentages: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let s = 1; s <= 5; s++) {
    const star = s as StarRating;
    const rawPct = ((counts[star] ?? 0) / totalReviews) * 100;
    percentages[star] = round ? Math.round(rawPct) : rawPct;
  }

  return percentages;
}

/**
 * Calculates independent category rating averages.
 * C_j = sum_{i in E_j}(c_ij) / |E_j|
 * Returns null if E_j is empty.
 * Never silently blends category ratings into the overall rating.
 */
export function calculateCategoryAverage(
  categoryRatings: (number | null | undefined)[],
): number | null {
  if (!categoryRatings || categoryRatings.length === 0) {
    return null;
  }

  let sum = 0;
  let count = 0;

  for (const r of categoryRatings) {
    if (r !== null && r !== undefined) {
      assertValidRating(r);
      sum += r;
      count += 1;
    }
  }

  if (count === 0) {
    return null;
  }

  return sum / count;
}

/**
 * Filters the review set E to include only eligible published reviews under policy.
 * Non-published reviews (FLAGGED, HIDDEN, REMOVED) are strictly excluded from public rating aggregates.
 */
export function filterEligibleReviews<T extends { status: string }>(reviews: T[]): T[] {
  if (!reviews) return [];
  return reviews.filter((r) => r.status === 'PUBLISHED');
}

/**
 * Derives completed-project count from authoritative project status.
 * N_completed = |{ p : (p.clientId == u || p.talentId == u) && p.status == 'COMPLETED' }|
 */
export function deriveCompletedProjectCount(
  projects: { status: string; clientId: string; talentId: string }[],
  userId: string,
): number {
  if (!projects || !userId) return 0;
  return projects.filter(
    (p) => p.status === 'COMPLETED' && (p.clientId === userId || p.talentId === userId),
  ).length;
}

/**
 * Authoritative aggregate calculator computing total count, arithmetic mean,
 * star counts, and star percentages from an array of eligible published reviews.
 */
export function computeRatingAggregates(ratings: number[]): RatingAggregates {
  const totalCount = ratings.length;
  const averageRating = calculateArithmeticMean(ratings);
  const starCounts = calculateStarCounts(ratings);
  const starPercentages = calculateStarPercentages(starCounts, totalCount, false);

  return {
    totalCount,
    averageRating,
    starCounts,
    starPercentages,
  };
}
