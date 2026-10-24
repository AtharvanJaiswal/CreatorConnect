'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CapsuleBadge } from '../../components/ui/cc-brand';
import {
  Search,
  Filter,
  MapPin,
  CheckCircle2,
  Briefcase,
  Users,
  ArrowRight,
  AlertCircle,
  Loader2,
  Calendar,
  Star,
  Sparkles,
  SlidersHorizontal,
  X,
  BadgeCheck,
  Clock,
  Bookmark,
} from 'lucide-react';
import type {
  DiscoveredCreatorResponse,
  CategoryResponse,
  SkillResponse,
  AssignmentResponse,
} from '@creatorconnect/contracts';
import { useAuth } from '../../providers/auth-provider';
import {
  searchCreators,
  fetchCategories,
  fetchSkills,
  formatMatchScore,
  getExplanationBadgeColor,
  buildFilterQuery,
  type DiscoveryFilterState,
} from '../../lib/discovery-workflow-service';
import { collaborationWorkflowService } from '../../lib/collaboration-workflow-service';

export default function DiscoveryPage() {
  const { accessToken } = useAuth();

  const [tab, setTab] = useState<'creators' | 'assignments'>('creators');
  const [showFilters, setShowFilters] = useState(false);

  // Filter States
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [minCompletedProjects, setMinCompletedProjects] = useState<number | undefined>(undefined);
  const [rateMin, setRateMin] = useState<number | undefined>(undefined);
  const [rateMax, setRateMax] = useState<number | undefined>(undefined);
  const [isVerifiedOnly, setIsVerifiedOnly] = useState(false);
  const [isAvailableOnly, setIsAvailableOnly] = useState(false);
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [sortBy, setSortBy] = useState<
    'relevance' | 'rating' | 'completedProjects' | 'rateAsc' | 'rateDesc' | 'newest'
  >('relevance');

  // Taxonomy
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [skills, setSkills] = useState<SkillResponse[]>([]);

  // Results & Pagination
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creators, setCreators] = useState<DiscoveredCreatorResponse[]>([]);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | undefined>(undefined);
  const [savedCreatorIds, setSavedCreatorIds] = useState<Set<string>>(new Set());
  const [savingCreatorId, setSavingCreatorId] = useState<string | null>(null);

  // Load taxonomy categories, skills, and saved creators on mount
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {});
    fetchSkills()
      .then(setSkills)
      .catch(() => {});
    if (accessToken) {
      collaborationWorkflowService
        .listSavedCreators({ limit: 100 }, accessToken)
        .then((res) => {
          setSavedCreatorIds(new Set(res.items.map((i) => i.creatorId)));
        })
        .catch(() => {});
    }
  }, [accessToken]);

  const handleToggleSave = async (creatorId: string) => {
    if (!accessToken) {
      alert('Please log in to save creators to your shortlists.');
      return;
    }
    setSavingCreatorId(creatorId);
    const isCurrentlySaved = savedCreatorIds.has(creatorId);

    // Optimistic toggle
    setSavedCreatorIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) {
        next.delete(creatorId);
      } else {
        next.add(creatorId);
      }
      return next;
    });

    try {
      if (isCurrentlySaved) {
        await collaborationWorkflowService.unsaveCreator(creatorId, accessToken);
      } else {
        await collaborationWorkflowService.saveCreator(creatorId, accessToken);
      }
    } catch {
      // Revert on error
      setSavedCreatorIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) {
          next.add(creatorId);
        } else {
          next.delete(creatorId);
        }
        return next;
      });
    } finally {
      setSavingCreatorId(null);
    }
  };

  const fetchResults = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);

      try {
        if (tab === 'creators') {
          const filterState: DiscoveryFilterState = {
            q: query,
            categoryId: selectedCategory || undefined,
            skillId: selectedSkill || undefined,
            minRating: minRating,
            minCompletedProjects: minCompletedProjects,
            rateMin: rateMin,
            rateMax: rateMax,
            isVerified: isVerifiedOnly || undefined,
            isAvailable: isAvailableOnly || undefined,
            isRemote: isRemoteOnly || undefined,
            sortBy,
          };

          const queryObj = buildFilterQuery(filterState, cursor, 12);
          const res = await searchCreators(queryObj, accessToken);

          setCreators((prev) => (cursor ? [...prev, ...res.items] : res.items));
          setNextCursor(res.nextCursor);
          setTotalMatches(res.totalMatches);
        } else {
          const params = new URLSearchParams();
          if (query) params.set('q', query);
          if (selectedCategory) params.set('categoryId', selectedCategory);
          if (isRemoteOnly) params.set('isRemote', 'true');
          if (cursor) params.set('cursor', cursor);
          params.set('limit', '12');

          const res = await fetch(`/api/v1/discovery/assignments?${params.toString()}`);
          if (!res.ok) throw new Error('Failed to load assignments');
          const data = await res.json();

          setAssignments((prev) => (cursor ? [...prev, ...data.items] : data.items));
          setNextCursor(data.nextCursor);
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred while searching.');
      } finally {
        setLoading(false);
      }
    },
    [
      tab,
      query,
      selectedCategory,
      selectedSkill,
      minRating,
      minCompletedProjects,
      rateMin,
      rateMax,
      isVerifiedOnly,
      isAvailableOnly,
      isRemoteOnly,
      sortBy,
      accessToken,
    ],
  );

  useEffect(() => {
    fetchResults();
  }, [
    tab,
    selectedCategory,
    selectedSkill,
    minRating,
    minCompletedProjects,
    isVerifiedOnly,
    isAvailableOnly,
    isRemoteOnly,
    sortBy,
  ]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchResults();
  };

  const handleClearAllFilters = () => {
    setQuery('');
    setSelectedCategory('');
    setSelectedSkill('');
    setMinRating(undefined);
    setMinCompletedProjects(undefined);
    setRateMin(undefined);
    setRateMax(undefined);
    setIsVerifiedOnly(false);
    setIsAvailableOnly(false);
    setIsRemoteOnly(false);
    setSortBy('relevance');
  };

  const hasActiveFilters = Boolean(
    query ||
    selectedCategory ||
    selectedSkill ||
    minRating ||
    minCompletedProjects ||
    rateMin !== undefined ||
    rateMax !== undefined ||
    isVerifiedOnly ||
    isAvailableOnly ||
    isRemoteOnly ||
    sortBy !== 'relevance',
  );

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#121212] py-8 px-4 sm:px-8">
      <div className="container max-w-7xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#EAE3D5] pb-8">
          <div>
            <CapsuleBadge variant="amber" className="mb-3">
              • DISCOVERY & EXPLAINABLE MATCHING
            </CapsuleBadge>
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl tracking-tight text-[#121212]">
              Find top verified{' '}
              <span className="font-serif italic font-normal text-[#121212]">
                creators & briefs.
              </span>
            </h1>
            <p className="text-[#5C564E] text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              Transparent, deterministic matching powered by skills, verified project history, and
              canonical published reputation.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-[#EFE9DF] p-1.5 rounded-full border border-[#E2DBD0] self-start md:self-auto">
            <button
              onClick={() => {
                setTab('creators');
                setNextCursor(null);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                tab === 'creators'
                  ? 'bg-white text-[#121212] shadow-sm'
                  : 'text-[#6B655C] hover:text-[#121212]'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-[#FFCE38]" />
              <span>Creators & Talent</span>
            </button>
            <button
              onClick={() => {
                setTab('assignments');
                setNextCursor(null);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all ${
                tab === 'assignments'
                  ? 'bg-white text-[#121212] shadow-sm'
                  : 'text-[#6B655C] hover:text-[#121212]'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5 text-[#FFCE38]" />
              <span>Brand Briefs</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Primary Actions */}
        <div className="space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8479]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === 'creators'
                    ? 'Search by name, skills, bio, or city (e.g. 3D Animator, Bengaluru)...'
                    : 'Search brand briefs by keywords, requirements (e.g. YouTube series)...'
                }
                className="w-full pl-11 pr-4 h-12 bg-white rounded-full border border-[#D9D2C5] text-sm font-medium text-[#121212] outline-none focus:ring-2 focus:ring-[#FFCE38] focus:border-transparent transition-all shadow-2xs"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8C8479] hover:text-[#121212]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`h-12 px-5 rounded-full border text-xs font-semibold inline-flex items-center gap-2 transition-all shrink-0 ${
                  showFilters || hasActiveFilters
                    ? 'bg-[#14110F] text-white border-[#14110F]'
                    : 'bg-white text-[#121212] border-[#D9D2C5] hover:bg-[#FAF7F2]'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4 text-[#FFD64A]" />
                <span>Filters</span>
                {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#FFD64A]" />}
              </button>

              <button
                type="submit"
                className="h-12 px-7 rounded-full bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] font-semibold text-sm shadow-sm inline-flex items-center gap-2 transition-all shrink-0"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </button>
            </div>
          </form>

          {/* Expandable Filter Panel */}
          {showFilters && tab === 'creators' && (
            <div className="bg-white rounded-3xl border border-[#EAE3D5] p-6 shadow-sm space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-[#EAE3D5] pb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#9B6C00]" />
                  <span className="font-heading font-bold text-sm text-[#121212]">
                    Structured Creator Filters
                  </span>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    className="text-xs font-semibold text-[#8C8479] hover:text-[#C93B2B] transition-colors"
                  >
                    Reset all filters
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Category Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#5C564E]">Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-medium text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Skill Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#5C564E]">Specific Skill</label>
                  <select
                    value={selectedSkill}
                    onChange={(e) => setSelectedSkill(e.target.value)}
                    className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-medium text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                  >
                    <option value="">All Skills</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Minimum Published Rating */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#5C564E]">Minimum Rating</label>
                  <select
                    value={minRating ?? ''}
                    onChange={(e) =>
                      setMinRating(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-medium text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                  >
                    <option value="">Any Rating</option>
                    <option value="4.5">★ 4.5+ Stars</option>
                    <option value="4.0">★ 4.0+ Stars</option>
                    <option value="3.5">★ 3.5+ Stars</option>
                    <option value="3.0">★ 3.0+ Stars</option>
                  </select>
                </div>

                {/* Verified Completed Projects */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#5C564E]">Completed Projects</label>
                  <select
                    value={minCompletedProjects ?? ''}
                    onChange={(e) =>
                      setMinCompletedProjects(e.target.value ? Number(e.target.value) : undefined)
                    }
                    className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-medium text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                  >
                    <option value="">Any Experience</option>
                    <option value="1">1+ Completed Project</option>
                    <option value="3">3+ Completed Projects</option>
                    <option value="5">5+ Completed Projects</option>
                    <option value="10">10+ Completed Projects</option>
                  </select>
                </div>

                {/* Starting Rate Min & Max */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-[#5C564E]">
                    Starting Rate Range (₹ INR)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={rateMin ?? ''}
                      onChange={(e) =>
                        setRateMin(e.target.value ? Number(e.target.value) : undefined)
                      }
                      className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-medium text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                    />
                    <span className="text-xs text-[#8C8479]">to</span>
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={rateMax ?? ''}
                      onChange={(e) =>
                        setRateMax(e.target.value ? Number(e.target.value) : undefined)
                      }
                      className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-medium text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                    />
                  </div>
                </div>

                {/* Sort Option */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-[#5C564E]">Sort Results By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full h-10 px-3 bg-[#FAF7F2] rounded-xl border border-[#D9D2C5] text-xs font-semibold text-[#121212] outline-none focus:ring-1 focus:ring-[#FFCE38]"
                  >
                    <option value="relevance">⚡ Best Match (Deterministic Relevance)</option>
                    <option value="rating">★ Highest Published Rating</option>
                    <option value="completedProjects">✓ Most Completed Projects</option>
                    <option value="rateAsc">₹ Starting Rate: Low to High</option>
                    <option value="rateDesc">₹ Starting Rate: High to Low</option>
                    <option value="newest">🕒 Recently Joined</option>
                  </select>
                </div>
              </div>

              {/* Checkbox Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-[#EAE3D5]/60 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isVerifiedOnly}
                    onChange={(e) => setIsVerifiedOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FFCE38] focus:ring-[#FFCE38] border-[#D9D2C5]"
                  />
                  <span>Verified Creators Only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAvailableOnly}
                    onChange={(e) => setIsAvailableOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FFCE38] focus:ring-[#FFCE38] border-[#D9D2C5]"
                  />
                  <span>Available for Projects</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isRemoteOnly}
                    onChange={(e) => setIsRemoteOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#FFCE38] focus:ring-[#FFCE38] border-[#D9D2C5]"
                  />
                  <span>Remote Friendly</span>
                </label>
              </div>
            </div>
          )}

          {/* Active Filter Chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-[#8C8479] uppercase tracking-wider">
                Active Filters:
              </span>

              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#D9D2C5] text-xs font-medium text-[#121212]">
                  Category: {categories.find((c) => c.id === selectedCategory)?.name || 'Selected'}
                  <button onClick={() => setSelectedCategory('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {selectedSkill && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#D9D2C5] text-xs font-medium text-[#121212]">
                  Skill: {skills.find((s) => s.id === selectedSkill)?.name || 'Selected'}
                  <button onClick={() => setSelectedSkill('')} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {minRating && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#D9D2C5] text-xs font-medium text-[#121212]">
                  ★ {minRating}+ Stars
                  <button onClick={() => setMinRating(undefined)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {minCompletedProjects && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#D9D2C5] text-xs font-medium text-[#121212]">
                  {minCompletedProjects}+ Completed Projects
                  <button
                    onClick={() => setMinCompletedProjects(undefined)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {isVerifiedOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#E0F2FE] border border-[#BAE6FD] text-xs font-medium text-[#0369A1]">
                  Verified Only
                  <button onClick={() => setIsVerifiedOnly(false)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {isAvailableOnly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-xs font-medium text-[#047857]">
                  Available Now
                  <button onClick={() => setIsAvailableOnly(false)} className="hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={handleClearAllFilters}
                className="text-xs font-bold text-[#8C8479] hover:text-[#121212] underline ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              onClick={() => fetchResults()}
              className="px-3 py-1 bg-white border border-red-200 rounded-full font-semibold hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {/* Result Header Count */}
        {tab === 'creators' && !loading && (
          <div className="flex items-center justify-between text-xs text-[#5C564E] pt-2">
            <span>
              Showing {creators.length} {totalMatches !== undefined ? `of ${totalMatches}` : ''}{' '}
              verified creator
              {creators.length === 1 ? '' : 's'}
            </span>
            <span className="font-semibold text-[#121212]">
              Sorted by: {sortBy === 'relevance' ? 'Best Match' : sortBy}
            </span>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && creators.length === 0 && assignments.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-[#EDE7DE] space-y-4 animate-pulse shadow-2xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#F2ECE3] rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-[#F2ECE3] rounded w-1/2" />
                    <div className="h-3 bg-[#F2ECE3] rounded w-1/3" />
                  </div>
                </div>
                <div className="h-4 bg-[#FAF7F2] rounded w-3/4" />
                <div className="h-12 bg-[#FAF7F2] rounded" />
                <div className="h-8 bg-[#F2ECE3] rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Creator Discovery Cards */}
        {tab === 'creators' && creators.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((c) => {
              const hasReviews = c.averageRating !== null && c.eligibleReviewCount > 0;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-3xl p-6 border border-[#EDE7DE] shadow-2xs hover:shadow-md hover:border-[#D6CEBF] transition-all flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3.5">
                    {/* Header: Avatar, Name, Verification, Match Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-[#FFD64A]/20 border border-[#FFD64A]/40 flex items-center justify-center font-bold text-sm text-[#14110F] shrink-0">
                          {c.avatarUrl ? (
                            <img
                              src={c.avatarUrl}
                              alt={c.displayName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            c.displayName
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-heading font-bold text-base text-[#121212] group-hover:text-[#9B6C00] transition-colors">
                              {c.displayName}
                            </h3>
                            {c.isVerified && (
                              <BadgeCheck className="w-4 h-4 text-[#1B66C9] shrink-0" />
                            )}
                          </div>
                          {c.locationCity && (
                            <div className="flex items-center gap-1 text-[11px] text-[#7C756B]">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {c.locationCity}, {c.locationCountry}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Match Score Badge & Save Button */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.matchScore > 0 && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF6D9] border border-[#FFD64A] text-[#9B6C00] text-[11px] font-bold">
                            <Sparkles className="w-3 h-3 text-[#FFCE38]" />
                            <span>{formatMatchScore(c.matchPercentage)}</span>
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleSave(c.userId);
                          }}
                          disabled={savingCreatorId === c.userId}
                          title={savedCreatorIds.has(c.userId) ? 'Unsave creator' : 'Save creator'}
                          className="p-1.5 rounded-full hover:bg-[#FAF7F2] border border-transparent hover:border-[#EDE7DE] transition-colors"
                        >
                          <Bookmark
                            className={`w-4 h-4 transition-colors ${
                              savedCreatorIds.has(c.userId)
                                ? 'fill-[#E0A800] text-[#E0A800]'
                                : 'text-[#8C8479] hover:text-[#121212]'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Tagline */}
                    <p className="text-xs font-semibold text-[#14110F] line-clamp-2 leading-snug">
                      {c.tagline || 'Verified Creator on CreatorConnect'}
                    </p>

                    {/* Bio */}
                    {c.bio && (
                      <p className="text-[11px] text-[#6B655C] line-clamp-2 leading-relaxed">
                        {c.bio}
                      </p>
                    )}

                    {/* Reputation & Experience Badges */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {hasReviews ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EAE3D5] text-[11px] font-semibold text-[#14110F]">
                          <Star className="w-3 h-3 fill-[#FFD64A] text-[#FFD64A]" />
                          <span>
                            {c.averageRating?.toFixed(1)} ({c.eligibleReviewCount})
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FAF7F2] border border-[#EAE3D5] text-[11px] text-[#8C8479]">
                          New Creator
                        </span>
                      )}

                      {c.completedProjectsCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E6F4EA] border border-[#B6E09B] text-[11px] font-semibold text-[#2E9E6B]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{c.completedProjectsCount} Completed</span>
                        </span>
                      )}

                      {c.isAvailable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[10px] font-medium text-[#047857]">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Available</span>
                        </span>
                      )}
                    </div>

                    {/* Grounded Match Explanations */}
                    {c.matchExplanations && c.matchExplanations.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-[#EAE3D5]/60">
                        <div className="text-[10px] font-bold text-[#8C8479] uppercase tracking-wider">
                          Why this match:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.matchExplanations.slice(0, 3).map((exp, idx) => {
                            const colors = getExplanationBadgeColor(exp.type);
                            return (
                              <span
                                key={idx}
                                style={{
                                  backgroundColor: colors.bg,
                                  color: colors.text,
                                  borderColor: colors.border,
                                }}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                              >
                                {exp.summary}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Skills Tags */}
                    {c.skills && c.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {c.skills.slice(0, 4).map((sk) => (
                          <span
                            key={sk.id}
                            className="bg-[#FAF7F2] border border-[#EAE3D5] text-[#5C564E] text-[10px] font-medium px-2 py-0.5 rounded-md"
                          >
                            {sk.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 border-t border-[#EAE3D5] flex items-center justify-between">
                    <div className="text-xs">
                      <span className="text-[#8C8479]">Starting at </span>
                      <span className="font-bold text-[#121212]">
                        ₹{c.startingRate ? c.startingRate.toLocaleString('en-IN') : 'Negotiable'}
                      </span>
                    </div>

                    <Link
                      href={`/profiles/${c.userId}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#14110F] hover:text-[#9B6C00] transition-colors"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Brand Briefs Grid */}
        {tab === 'assignments' && assignments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-3xl p-6 border border-[#EDE7DE] shadow-2xs hover:shadow-md hover:border-[#D6CEBF] transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="bg-[#FFF6D9] text-[#7A5B00] border border-[#FCE192] text-xs font-semibold px-3 py-0.5 rounded-full">
                      {a.status}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-[#7C756B]">
                      <Calendar className="h-3 w-3 text-[#7A5B00]" />
                      <span>Due {new Date(a.deadline).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-heading font-bold text-lg text-[#121212]">{a.title}</h3>
                    <div className="text-xs font-semibold text-[#8C8479] uppercase tracking-wider mt-0.5">
                      by {(a as any).brand?.companyName || 'Verified Brand'}
                    </div>
                  </div>

                  <p className="text-xs text-[#6B655C] line-clamp-3 leading-relaxed">
                    {a.description}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-[#EAE3D5] flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-[#8C8479]">Budget: </span>
                    <span className="font-bold text-[#121212]">
                      ₹{a.budgetMin?.toLocaleString('en-IN') || '0'} - ₹
                      {a.budgetMax?.toLocaleString('en-IN') || 'Flexible'}
                    </span>
                  </div>
                  <Link
                    href={`/assignments/${a.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] px-4 py-2 rounded-full shadow-2xs transition-all"
                  >
                    <span>View & Apply</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          ((tab === 'creators' && creators.length === 0) ||
            (tab === 'assignments' && assignments.length === 0)) && (
            <div className="bg-white rounded-3xl p-12 text-center space-y-4 border border-[#EDE7DE] shadow-2xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FAF7F2] text-[#8C8479]">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-bold text-xl text-[#121212]">
                No matching results found
              </h3>
              <p className="text-xs sm:text-sm text-[#6B655C] max-w-md mx-auto leading-relaxed">
                We couldn&apos;t find anything matching your search filters. Try adjusting keywords,
                lowering rating criteria, or resetting filters.
              </p>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-6 py-2.5 rounded-full border border-[#D9D2C5] text-xs font-semibold hover:bg-[#FAF7F2] transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          )}

        {/* Keyset Cursor Pagination */}
        {nextCursor && (
          <div className="flex justify-center pt-6">
            <button
              onClick={() => fetchResults(nextCursor)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-[#D9D2C5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#121212] shadow-2xs transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#9B6C00]" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              <span>Load More Results</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
