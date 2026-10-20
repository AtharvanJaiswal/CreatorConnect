import { describe, it, expect } from 'vitest';
import {
  isValidRating,
  assertValidRating,
  calculateArithmeticMean,
  roundRatingForDisplay,
  formatRating,
  calculateStarCounts,
  calculateStarPercentages,
  calculateCategoryAverage,
  filterEligibleReviews,
  deriveCompletedProjectCount,
  computeRatingAggregates,
} from './rating.js';

describe('Authoritative Rating & Reputation Algorithm (Phase 9)', () => {
  describe('Input Validation (3.1)', () => {
    it('accepts valid integer ratings 1, 2, 3, 4, 5', () => {
      expect(isValidRating(1)).toBe(true);
      expect(isValidRating(2)).toBe(true);
      expect(isValidRating(3)).toBe(true);
      expect(isValidRating(4)).toBe(true);
      expect(isValidRating(5)).toBe(true);
    });

    it('rejects 0, negative values, decimals, strings, NaN, Infinity, and values > 5', () => {
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(-1)).toBe(false);
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(4.5)).toBe(false);
      expect(isValidRating('5')).toBe(false);
      expect(isValidRating(NaN)).toBe(false);
      expect(isValidRating(Infinity)).toBe(false);
      expect(isValidRating(null)).toBe(false);
      expect(isValidRating(undefined)).toBe(false);
    });

    it('assertValidRating throws appropriate errors for invalid inputs', () => {
      expect(() => assertValidRating(0)).toThrow(RangeError);
      expect(() => assertValidRating(6)).toThrow(RangeError);
      expect(() => assertValidRating(4.2)).toThrow(RangeError);
      expect(() => assertValidRating('5')).toThrow(TypeError);
      expect(() => assertValidRating(NaN)).toThrow(TypeError);
    });
  });

  describe('Arithmetic Mean Calculation (3.2)', () => {
    it('returns null when no eligible reviews exist (n = 0)', () => {
      expect(calculateArithmeticMean([])).toBeNull();
    });

    it('computes exact arithmetic mean: Ratings [5, 4, 4, 5, 3] => 21/5 = 4.2', () => {
      const ratings = [5, 4, 4, 5, 3];
      const mean = calculateArithmeticMean(ratings);
      expect(mean).toBe(4.2);
    });

    it('preserves full floating point precision internally', () => {
      // 5 + 4 + 4 = 13 / 3 = 4.333333333333333
      const ratings = [5, 4, 4];
      const mean = calculateArithmeticMean(ratings);
      expect(mean).toBeCloseTo(4.333333333333333, 10);
    });

    it('never displays zero stars as if a creator received a zero rating', () => {
      const mean = calculateArithmeticMean([]);
      expect(formatRating(mean)).toBe('Unrated');
      expect(formatRating(null)).toBe('Unrated');
    });

    it('formats display ratings with single decimal precision', () => {
      expect(formatRating(4.2)).toBe('4.2');
      expect(formatRating(5)).toBe('5.0');
      expect(roundRatingForDisplay(4.3333333333, 1)).toBe(4.3);
      expect(roundRatingForDisplay(4.3333333333, 2)).toBe(4.33);
      expect(roundRatingForDisplay(null)).toBeNull();
    });
  });

  describe('Star Distribution (3.3)', () => {
    it('computes correct frequency counts for each star value', () => {
      const ratings = [5, 4, 4, 5, 3];
      const counts = calculateStarCounts(ratings);
      expect(counts).toEqual({
        1: 0,
        2: 0,
        3: 1,
        4: 2,
        5: 2,
      });
    });

    it('computes star distribution percentages summing to 100% when reviews exist', () => {
      const ratings = [5, 4, 4, 5, 3];
      const counts = calculateStarCounts(ratings);
      const percentages = calculateStarPercentages(counts, 5, false);

      expect(percentages[5]).toBe(40); // 2/5 = 40%
      expect(percentages[4]).toBe(40); // 2/5 = 40%
      expect(percentages[3]).toBe(20); // 1/5 = 20%
      expect(percentages[2]).toBe(0);
      expect(percentages[1]).toBe(0);

      const sum =
        percentages[1] + percentages[2] + percentages[3] + percentages[4] + percentages[5];
      expect(sum).toBe(100);
    });

    it('returns 0% for all stars without division by zero when no reviews exist', () => {
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const percentages = calculateStarPercentages(counts, 0);
      expect(percentages).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
    });
  });

  describe('Category Scores (3.4)', () => {
    it('calculates category means only from reviews that actually contain that category', () => {
      // 3 reviews provided communication ratings [5, 4, 5], 2 reviews omitted it (null/undefined)
      const commRatings = [5, null, 4, undefined, 5];
      const avg = calculateCategoryAverage(commRatings);
      expect(avg).toBeCloseTo(14 / 3, 5); // 4.66667
    });

    it('returns null when category review set is empty', () => {
      expect(calculateCategoryAverage([])).toBeNull();
      expect(calculateCategoryAverage([null, undefined])).toBeNull();
    });

    it('rejects invalid category rating values', () => {
      expect(() => calculateCategoryAverage([5, 0, 4])).toThrow(RangeError);
      expect(() => calculateCategoryAverage([5, 6, 4])).toThrow(RangeError);
    });
  });

  describe('Completed-Project Count Derivation (3.5)', () => {
    it('derives count exclusively from authoritative COMPLETED project status', () => {
      const userId = 'user-creator-1';
      const projects = [
        { status: 'COMPLETED', clientId: 'client-1', talentId: userId },
        { status: 'COMPLETED', clientId: userId, talentId: 'creator-2' },
        { status: 'IN_PROGRESS', clientId: 'client-1', talentId: userId },
        { status: 'CANCELLED', clientId: 'client-1', talentId: userId },
        { status: 'DRAFT', clientId: 'client-1', talentId: userId },
      ];

      const count = deriveCompletedProjectCount(projects, userId);
      expect(count).toBe(2);
    });

    it('returns 0 if user has no completed projects', () => {
      const userId = 'user-creator-2';
      const count = deriveCompletedProjectCount([], userId);
      expect(count).toBe(0);
    });
  });

  describe('Aggregate Inclusion Policy (3.6)', () => {
    it('filters review set to include only PUBLISHED reviews in aggregates', () => {
      const reviews = [
        { id: '1', status: 'PUBLISHED', rating: 5 },
        { id: '2', status: 'FLAGGED', rating: 1 },
        { id: '3', status: 'HIDDEN', rating: 2 },
        { id: '4', status: 'REMOVED', rating: 1 },
        { id: '5', status: 'PUBLISHED', rating: 4 },
      ];

      const eligible = filterEligibleReviews(reviews);
      expect(eligible.map((r) => r.id)).toEqual(['1', '5']);

      const aggregates = computeRatingAggregates(eligible.map((r) => r.rating));
      expect(aggregates.totalCount).toBe(2);
      expect(aggregates.averageRating).toBe(4.5);
      expect(aggregates.starCounts[5]).toBe(1);
      expect(aggregates.starCounts[4]).toBe(1);
    });
  });
});
