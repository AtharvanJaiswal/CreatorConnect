import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildFilterQuery,
  formatMatchScore,
  getExplanationBadgeColor,
  searchCreators,
  fetchCategories,
  fetchSkills,
  type DiscoveryFilterState,
} from './discovery-workflow-service';

describe('Discovery Workflow Service (web-shell)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildFilterQuery', () => {
    it('constructs API query object from filter state correctly', () => {
      const filters: DiscoveryFilterState = {
        q: 'Motion Graphics',
        categoryId: 'cat-123',
        skillId: 'skill-456',
        minRating: 4.5,
        minCompletedProjects: 3,
        rateMin: 15000,
        rateMax: 50000,
        isVerified: true,
        isAvailable: true,
        isRemote: true,
        sortBy: 'rating',
        matchProjectId: 'proj-789',
      };

      const query = buildFilterQuery(filters, 'cursor-abc', 15);

      expect(query.q).toBe('Motion Graphics');
      expect(query.categoryId).toBe('cat-123');
      expect(query.skillId).toBe('skill-456');
      expect(query.minRating).toBe(4.5);
      expect(query.minCompletedProjects).toBe(3);
      expect(query.rateMin).toBe(15000);
      expect(query.rateMax).toBe(50000);
      expect(query.isVerified).toBe(true);
      expect(query.isAvailable).toBe(true);
      expect(query.isRemote).toBe(true);
      expect(query.sortBy).toBe('rating');
      expect(query.matchProjectId).toBe('proj-789');
      expect(query.cursor).toBe('cursor-abc');
      expect(query.limit).toBe(15);
    });

    it('omits undefined or empty filters cleanly', () => {
      const query = buildFilterQuery({});
      expect(query.q).toBeUndefined();
      expect(query.categoryId).toBeUndefined();
      expect(query.minRating).toBeUndefined();
      expect(query.limit).toBe(20);
    });
  });

  describe('formatMatchScore', () => {
    it('formats percentages into badge strings', () => {
      expect(formatMatchScore(92)).toBe('92% Match');
      expect(formatMatchScore(0)).toBe('0% Match');
      expect(formatMatchScore(105)).toBe('100% Match');
      expect(formatMatchScore(-10)).toBe('0% Match');
    });
  });

  describe('getExplanationBadgeColor', () => {
    it('returns appropriate Stitch design colors per explanation type', () => {
      const skillColors = getExplanationBadgeColor('skill');
      expect(skillColors.bg).toBe('#EBF3FE');

      const budgetColors = getExplanationBadgeColor('budget');
      expect(budgetColors.bg).toBe('#E6F4EA');

      const ratingColors = getExplanationBadgeColor('rating');
      expect(ratingColors.bg).toBe('#FFF6D9');

      const fallbackColors = getExplanationBadgeColor('unknown');
      expect(fallbackColors.bg).toBe('#FAF6EF');
    });
  });

  describe('searchCreators API client', () => {
    it('calls /api/v1/discovery/creators with query parameters and Authorization header', async () => {
      const mockResponse = {
        items: [],
        nextCursor: null,
        hasMore: false,
        totalMatches: 0,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const res = await searchCreators({ q: 'Editor', isVerified: true }, 'jwt-token-xyz');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0]!;
      const url = call[0];
      const options = call[1];
      expect(url.toString()).toContain('/api/v1/discovery/creators?q=Editor&isVerified=true');
      expect((options as RequestInit).headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-token-xyz',
      });
      expect(res).toEqual(mockResponse);
    });

    it('throws error when search endpoint responds with non-200 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Project specified for matching was not found.' }),
      } as Response);

      await expect(searchCreators({ matchProjectId: 'non-existent' })).rejects.toThrow(
        'Project specified for matching was not found.',
      );
    });
  });

  describe('fetchCategories and fetchSkills', () => {
    it('loads taxonomy categories and skills', async () => {
      const mockCats = [{ id: '1', slug: 'video', name: 'Video' }];
      const mockSkills = [{ id: '2', slug: 'vfx', name: 'VFX' }];

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCats,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSkills,
        } as Response);

      const cats = await fetchCategories();
      const skills = await fetchSkills();

      expect(cats).toEqual(mockCats);
      expect(skills).toEqual(mockSkills);
    });
  });
});
