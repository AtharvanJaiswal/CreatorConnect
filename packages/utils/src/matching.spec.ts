import { describe, expect, it } from 'vitest';
import {
  calculateJaccardSimilarity,
  normalizeRating,
  normalizeCompletedProjects,
  calculateBudgetScore,
  evaluateEligibility,
  scoreCreatorCandidate,
  rankAndSortCreators,
  DEFAULT_MATCHING_WEIGHTS,
  type CreatorCandidate,
  type MatchingQueryContext,
} from './matching.js';

describe('Canonical Deterministic Matching Module (Phase 10)', () => {
  const mockCandidate: CreatorCandidate = {
    creatorId: 'c1111111-1111-1111-1111-111111111111',
    userId: 'u1111111-1111-1111-1111-111111111111',
    displayName: 'Aarav Sharma',
    tagline: 'Senior Motion Designer & VFX Artist',
    bio: '10 years crafting high-end commercials for global brands.',
    skillIds: ['skill-vfx', 'skill-motion', 'skill-blender'],
    skillNames: ['VFX', 'Motion Graphics', 'Blender 3D'],
    categoryIds: ['cat-video'],
    categoryNames: ['Video Production'],
    startingRate: 25000,
    currency: 'INR',
    averageRating: 4.8,
    eligibleReviewCount: 12,
    completedProjectsCount: 8,
    isAvailable: true,
    isVerified: true,
    locationCountry: 'IN',
    locationCity: 'Bengaluru',
    isRemote: true,
    createdAt: '2026-01-01T10:00:00.000Z',
  };

  describe('Feature Normalization & Edge Cases', () => {
    it('calculates Jaccard similarity correctly', () => {
      expect(calculateJaccardSimilarity(['a', 'b'], ['b', 'c'])).toBeCloseTo(1 / 3, 4);
      expect(calculateJaccardSimilarity(['a', 'b'], ['a', 'b'])).toBe(1.0);
      expect(calculateJaccardSimilarity(['a'], ['b'])).toBe(0.0);
      // Empty set behavior: do not artificially reward empty matching
      expect(calculateJaccardSimilarity([], [])).toBe(0);
      expect(calculateJaccardSimilarity(['a'], [])).toBe(0);
    });

    it('normalizes ratings onto [0, 1] bounded scale and handles missing ratings without penalty', () => {
      expect(normalizeRating(5.0)).toBe(1.0);
      expect(normalizeRating(1.0)).toBe(0.0);
      expect(normalizeRating(3.0)).toBe(0.5);
      expect(normalizeRating(4.2)).toBeCloseTo(0.8, 4);

      // Missing ratings return null (never 0 stars)
      expect(normalizeRating(null)).toBeNull();
      expect(normalizeRating(NaN)).toBeNull();
    });

    it('normalizes completed projects count against benchmark', () => {
      expect(normalizeCompletedProjects(0)).toBe(0);
      expect(normalizeCompletedProjects(-5)).toBe(0);
      expect(normalizeCompletedProjects(5, 10)).toBe(0.5);
      expect(normalizeCompletedProjects(10, 10)).toBe(1.0);
      expect(normalizeCompletedProjects(25, 10)).toBe(1.0); // Clamped to 1.0
    });

    it('calculates budget compatibility with linear tolerance falloff', () => {
      // In budget
      expect(calculateBudgetScore(20000, 10000, 30000)).toBe(1.0);
      expect(calculateBudgetScore(10000, 10000, 30000)).toBe(1.0);
      expect(calculateBudgetScore(30000, 10000, 30000)).toBe(1.0);

      // Slightly over budget (tolerance = 15000; overage = 5000 -> 1 - 5000/15000 = 0.6667)
      expect(calculateBudgetScore(35000, 10000, 30000)).toBeCloseTo(0.6667, 3);

      // Way over budget (overage = 20000 > tolerance of 15000 -> 0)
      expect(calculateBudgetScore(55000, 10000, 30000)).toBe(0.0);

      // Missing starting rate or budget returns null (feature omitted)
      expect(calculateBudgetScore(null, 10000, 30000)).toBeNull();
      expect(calculateBudgetScore(20000, null, null)).toBeNull();
    });
  });

  describe('Eligibility Verification (Hard Filters)', () => {
    it('rejects candidate if requireVerified is set and candidate is not verified', () => {
      const unverified = { ...mockCandidate, isVerified: false };
      expect(evaluateEligibility(unverified, { requireVerified: true })).toBe(false);
      expect(evaluateEligibility(mockCandidate, { requireVerified: true })).toBe(true);
    });

    it('rejects candidate if requireAvailable is set and candidate is unavailable', () => {
      const busy = { ...mockCandidate, isAvailable: false };
      expect(evaluateEligibility(busy, { requireAvailable: true })).toBe(false);
      expect(evaluateEligibility(mockCandidate, { requireAvailable: true })).toBe(true);
    });

    it('rejects candidate below minRating threshold', () => {
      expect(evaluateEligibility(mockCandidate, { minRating: 4.9 })).toBe(false);
      expect(evaluateEligibility(mockCandidate, { minRating: 4.5 })).toBe(true);
    });

    it('rejects candidate below minCompletedProjects threshold', () => {
      expect(evaluateEligibility(mockCandidate, { minCompletedProjects: 10 })).toBe(false);
      expect(evaluateEligibility(mockCandidate, { minCompletedProjects: 5 })).toBe(true);
    });
  });

  describe('Weighted Scoring & Weight Renormalization', () => {
    it('renormalizes weights dynamically when active features are missing', () => {
      // Query specifies only skills and budget
      const query: MatchingQueryContext = {
        requiredSkillIds: ['skill-vfx', 'skill-motion'],
        budgetMin: 20000,
        budgetMax: 30000,
      };

      const result = scoreCreatorCandidate(mockCandidate, query);

      expect(result.isEligible).toBe(true);
      expect(result.matchScore).toBeGreaterThan(0);
      expect(result.matchScore).toBeLessThanOrEqual(1.0);

      // Active features should sum to exactly 1.0
      const weightSum = Object.values(result.normalizedWeights).reduce((a, b) => a + b, 0);
      expect(weightSum).toBeCloseTo(1.0, 3);
    });

    it('handles candidate with no reviews without penalizing score', () => {
      const unratedCreator: CreatorCandidate = {
        ...mockCandidate,
        averageRating: null,
        eligibleReviewCount: 0,
      };

      const query: MatchingQueryContext = {
        requiredSkillIds: ['skill-vfx', 'skill-motion', 'skill-blender'],
        preferredCategoryIds: ['cat-video'],
      };

      const result = scoreCreatorCandidate(unratedCreator, query);

      expect(result.isEligible).toBe(true);
      expect(result.activeFeatures).not.toContain('publishedReputation');

      // The weights are renormalized across skillOverlap and categoryRelevance
      const weightSum = Object.values(result.normalizedWeights).reduce((a, b) => a + b, 0);
      expect(weightSum).toBeCloseTo(1.0, 3);
    });

    it('falls back cleanly to 0 score when no active scoring features exist', () => {
      const plainCandidate: CreatorCandidate = {
        ...mockCandidate,
        completedProjectsCount: 0,
        averageRating: null,
        eligibleReviewCount: 0,
        startingRate: null,
      };

      const emptyQuery: MatchingQueryContext = {};
      const result = scoreCreatorCandidate(plainCandidate, emptyQuery);

      expect(result.isEligible).toBe(true);
      expect(result.matchScore).toBe(0);
      expect(result.matchPercentage).toBe(0);
      expect(result.activeFeatures.length).toBe(0);
    });

    it('generates rich, verifiable explainability items grounded in actual candidate data', () => {
      const query: MatchingQueryContext = {
        requiredSkillIds: ['skill-vfx', 'skill-motion'],
        preferredCategoryIds: ['cat-video'],
        budgetMin: 20000,
        budgetMax: 30000,
      };

      const result = scoreCreatorCandidate(mockCandidate, query);

      expect(result.explanations.length).toBeGreaterThan(0);
      const skillExp = result.explanations.find((e) => e.type === 'skill');
      expect(skillExp).toBeDefined();
      expect(skillExp?.summary).toContain('Matches 2 of 2 required skills');

      const budgetExp = result.explanations.find((e) => e.type === 'budget');
      expect(budgetExp).toBeDefined();
      expect(budgetExp?.summary).toBe('Within specified budget range');

      const ratingExp = result.explanations.find((e) => e.type === 'rating');
      expect(ratingExp?.summary).toContain('4.8/5.0');
    });
  });

  describe('Deterministic Ranking & Tie-Breaking', () => {
    it('deterministically sorts candidates by relevance score, completed projects, rating, and ID', () => {
      const candidateA: CreatorCandidate = {
        ...mockCandidate,
        creatorId: '00000000-0000-0000-0000-000000000001',
        skillIds: ['skill-vfx', 'skill-motion'], // 100% skill match
        completedProjectsCount: 10,
        averageRating: 5.0,
      };

      const candidateB: CreatorCandidate = {
        ...mockCandidate,
        creatorId: '00000000-0000-0000-0000-000000000002',
        skillIds: ['skill-vfx'], // 50% skill match
        completedProjectsCount: 2,
        averageRating: 4.0,
      };

      const candidateC: CreatorCandidate = {
        ...mockCandidate,
        creatorId: '00000000-0000-0000-0000-000000000003',
        isAvailable: false, // Ineligible when requireAvailable: true
      };

      const query: MatchingQueryContext = {
        requiredSkillIds: ['skill-vfx', 'skill-motion'],
        requireAvailable: true,
      };

      const ranked = rankAndSortCreators([candidateB, candidateC, candidateA], query);

      expect(ranked[0].candidate.creatorId).toBe(candidateA.creatorId);
      expect(ranked[1].candidate.creatorId).toBe(candidateB.creatorId);
      expect(ranked[2].candidate.creatorId).toBe(candidateC.creatorId);
      expect(ranked[2].isEligible).toBe(false);
    });

    it('tie-breaks identical scores using completed projects then creatorId', () => {
      const candidate1: CreatorCandidate = {
        ...mockCandidate,
        creatorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        completedProjectsCount: 5,
      };
      const candidate2: CreatorCandidate = {
        ...mockCandidate,
        creatorId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        completedProjectsCount: 5,
      };

      const ranked = rankAndSortCreators([candidate2, candidate1], {});
      // With identical score, projects, rating, creatorId alphabetical order wins
      expect(ranked[0].candidate.creatorId).toBe(candidate1.creatorId);
      expect(ranked[1].candidate.creatorId).toBe(candidate2.creatorId);
    });
  });
});
