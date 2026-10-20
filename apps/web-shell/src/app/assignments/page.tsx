'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Calendar,
  Building2,
  ArrowRight,
  PlusCircle,
  Briefcase,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  assignmentsWorkflowService,
  formatMinorUnitsToCurrency,
  getAssignmentStatusBadgeVariant,
} from '../../lib/assignments-workflow-service';
import { useAuth } from '../../providers/auth-provider';
import type { AssignmentResponse } from '@creatorconnect/contracts';

const CATEGORIES = [
  { id: 'all', label: 'All Opportunities' },
  { id: 'directing', label: 'Directing & Filming' },
  { id: 'video-editing', label: 'Post-Production & Editing' },
  { id: 'sound-design', label: 'Sound & Audio' },
  { id: 'motion-graphics', label: 'Motion & 3D' },
  { id: 'podcast', label: 'Podcast & Voice' },
];

export default function BrowseAssignmentsPage() {
  const { accessToken } = useAuth();

  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States (G01 & G02)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isRemoteOnly, setIsRemoteOnly] = useState(false);
  const [budgetTypeFilter, setBudgetTypeFilter] = useState<'ALL' | 'FIXED' | 'RANGE' | 'HOURLY'>(
    'ALL',
  );
  const [minBudget, setMinBudget] = useState<number | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query: any = {};
      if (searchQuery.trim()) query.q = searchQuery.trim();
      if (isRemoteOnly) query.isRemote = true;
      if (minBudget !== undefined && minBudget > 0) query.budgetMin = minBudget * 100; // to paise

      const res = await assignmentsWorkflowService.searchAssignments(
        query,
        accessToken || undefined,
      );
      let items = res.items || [];

      if (budgetTypeFilter !== 'ALL') {
        items = items.filter((item) => item.budgetType === budgetTypeFilter);
      }

      setAssignments(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, isRemoteOnly, minBudget, budgetTypeFilter, accessToken]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] antialiased">
      {/* ========================================================
           HERO & BROWSE HEADER (G01)
           ======================================================== */}
      <section className="border-b border-[#E7E0D5] bg-[#FAF6EF] px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD64A] bg-[#FFD64A]/20 px-3.5 py-1 text-xs font-bold text-[#875A00] uppercase tracking-wider mb-4">
                <Sparkles className="h-3.5 w-3.5 text-[#875A00]" />
                Google Stitch G01 · Assignment Marketplace
              </div>
              <h1 className="font-heading font-black text-3xl sm:text-5xl tracking-tight text-[#14110F]">
                Browse{' '}
                <span className="font-serif italic font-normal text-[#6F675E]">Verified</span>{' '}
                Assignments
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#6F675E] max-w-2xl">
                Discover escrow-funded briefs from verified brands and creators. Clear deliverables,
                milestone tracking, and guaranteed payouts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/assignments/my">
                <button className="flex items-center gap-2 rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-5 py-2.5 text-xs font-bold text-[#14110F] transition-all hover:bg-[#F2ECE1] shadow-2xs">
                  <Briefcase className="h-4 w-4 text-[#6F675E]" />
                  My Assignments
                </button>
              </Link>
              <Link href="/assignments/create">
                <button className="flex items-center gap-2 rounded-full bg-[#FFD64A] px-5 py-2.5 text-xs font-bold text-[#14110F] transition-all hover:bg-[#F5CB35] shadow-2xs">
                  <PlusCircle className="h-4 w-4" />
                  Post an Assignment
                </button>
              </Link>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="mt-8 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A39A8F]" />
              <input
                type="text"
                placeholder="Search briefs, keywords, required skills, or creative roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-[#E7E0D5] bg-[#FFFFFF] py-3 pl-11 pr-4 text-sm text-[#14110F] placeholder-[#A39A8F] focus:border-[#14110F] focus:outline-none focus:ring-1 focus:ring-[#14110F] shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A39A8F] hover:text-[#14110F]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#14110F] text-[#FFFFFF] shadow-2xs'
                      : 'border border-[#E7E0D5] bg-[#FFFFFF] text-[#6F675E] hover:bg-[#F2ECE1] hover:text-[#14110F]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}

              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex items-center gap-1.5 rounded-full border border-[#E7E0D5] bg-[#FFFFFF] px-4 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F2ECE1] transition-all"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
           MAIN CONTENT: FILTERS (G02) + RESULTS (G01)
           ======================================================== */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Filters (G02 Specification) */}
          <aside
            className={`lg:block ${isSidebarOpen ? 'block' : 'hidden'} lg:col-span-1 rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs h-fit space-y-6`}
          >
            <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-4">
              <h2 className="font-heading font-black text-sm uppercase tracking-wider text-[#14110F] flex items-center gap-2">
                <Filter className="h-4 w-4 text-[#875A00]" />
                Refine Search
              </h2>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setIsRemoteOnly(false);
                  setBudgetTypeFilter('ALL');
                  setMinBudget(undefined);
                }}
                className="text-xs font-semibold text-[#875A00] hover:underline"
              >
                Reset All
              </button>
            </div>

            {/* Compensation Model */}
            <div>
              <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2.5">
                Compensation Model
              </label>
              <div className="space-y-1.5">
                {(['ALL', 'FIXED', 'RANGE', 'HOURLY'] as const).map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2.5 text-xs text-[#6F675E] hover:text-[#14110F] cursor-pointer py-1"
                  >
                    <input
                      type="radio"
                      name="budgetType"
                      checked={budgetTypeFilter === type}
                      onChange={() => setBudgetTypeFilter(type)}
                      className="accent-[#14110F]"
                    />
                    <span>{type === 'ALL' ? 'Any Structure' : type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Remote Work Toggle */}
            <div className="border-t border-[#E7E0D5] pt-4">
              <label className="flex items-center justify-between text-xs font-bold text-[#14110F] cursor-pointer">
                <span>Remote Engagements Only</span>
                <input
                  type="checkbox"
                  checked={isRemoteOnly}
                  onChange={(e) => setIsRemoteOnly(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#14110F]"
                />
              </label>
            </div>

            {/* Minimum Budget Preset */}
            <div className="border-t border-[#E7E0D5] pt-4">
              <label className="block text-xs font-bold text-[#14110F] uppercase tracking-wider mb-2">
                Minimum Budget
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                {[
                  { label: 'Any', value: undefined },
                  { label: '₹25,000+', value: 25000 },
                  { label: '₹50,000+', value: 50000 },
                  { label: '₹1,00,000+', value: 100000 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setMinBudget(preset.value)}
                    className={`rounded-xl border py-2 px-2.5 text-center transition-all ${
                      minBudget === preset.value
                        ? 'border-[#14110F] bg-[#14110F] text-[#FFFFFF]'
                        : 'border-[#E7E0D5] bg-[#FAF6EF] text-[#6F675E] hover:bg-[#F2ECE1]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={loadAssignments}
              className="w-full rounded-full bg-[#14110F] py-2.5 text-xs font-bold text-[#FFFFFF] hover:bg-[#2C2724] transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Apply Filters
            </button>
          </aside>

          {/* Results Grid (G01 Specification) */}
          <main className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-[#6F675E] uppercase tracking-wider">
                Showing {assignments.length} Available{' '}
                {assignments.length === 1 ? 'Assignment' : 'Assignments'}
              </p>
              <button
                onClick={loadAssignments}
                disabled={loading}
                className="flex items-center gap-1 text-xs text-[#875A00] font-semibold hover:underline"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 bg-[#FFFFFF] rounded-[24px] border border-[#E7E0D5]">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#FFD64A] border-t-[#14110F]" />
                <p className="mt-4 text-xs font-bold text-[#6F675E] uppercase tracking-wider">
                  Loading verified briefs...
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-[24px] border border-[#FFB6C8] bg-[#FFB6C8]/15 p-6 text-center">
                <p className="text-sm font-bold text-[#A02842]">{error}</p>
                <button
                  onClick={loadAssignments}
                  className="mt-3 rounded-full bg-[#14110F] px-4 py-1.5 text-xs font-bold text-[#FFFFFF]"
                >
                  Retry Search
                </button>
              </div>
            )}

            {!loading && !error && assignments.length === 0 && (
              <div className="rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-12 text-center shadow-2xs">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FAF6EF] text-[#875A00]">
                  <Briefcase className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-heading font-black text-lg text-[#14110F]">
                  No matching assignments found
                </h3>
                <p className="mt-1 text-xs text-[#6F675E] max-w-md mx-auto">
                  Try adjusting your search keywords, lowering the minimum budget threshold, or
                  removing specific filter constraints.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setMinBudget(undefined);
                    setIsRemoteOnly(false);
                    setBudgetTypeFilter('ALL');
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#FFD64A] px-5 py-2 text-xs font-bold text-[#14110F] hover:bg-[#F5CB35]"
                >
                  Clear All Filters
                </button>
              </div>
            )}

            {!loading && !error && assignments.length > 0 && (
              <div className="space-y-4">
                {assignments.map((asn) => {
                  const statusVariant = getAssignmentStatusBadgeVariant(asn.status);
                  const isBudgetRange = asn.budgetType === 'RANGE';

                  return (
                    <div
                      key={asn.id}
                      className="group rounded-[24px] border border-[#E7E0D5] bg-[#FFFFFF] p-6 shadow-2xs transition-all hover:border-[#FFD64A] hover:shadow-card-hover"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* Top Meta: Verified Brand & Status */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-[#6F675E]">
                              <Building2 className="h-3.5 w-3.5 text-[#875A00]" />
                              Verified Client
                            </span>
                            <span className="text-[#E7E0D5]">•</span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusVariant.bg} ${statusVariant.text} ${statusVariant.border}`}
                            >
                              {statusVariant.label}
                            </span>
                            {asn.isRemote && (
                              <span className="rounded-full bg-[#C9B6F7]/20 border border-[#C9B6F7] px-2.5 py-0.5 text-[10px] font-bold text-[#4F3690]">
                                🌐 Remote
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <Link href={`/assignments/${asn.id}`}>
                            <h3 className="font-heading font-black text-lg sm:text-xl text-[#14110F] group-hover:text-[#875A00] transition-colors">
                              {asn.title}
                            </h3>
                          </Link>

                          {/* Description snippet */}
                          <p className="mt-2 text-xs sm:text-sm text-[#6F675E] line-clamp-2">
                            {asn.description}
                          </p>

                          {/* Requirements & Skills Tags */}
                          {asn.requirements && asn.requirements.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {asn.requirements.slice(0, 4).map((req) => (
                                <span
                                  key={req.id}
                                  className="rounded-full border border-[#E7E0D5] bg-[#FAF6EF] px-3 py-1 text-[11px] font-semibold text-[#14110F]"
                                >
                                  {req.title}
                                </span>
                              ))}
                              {asn.requirements.length > 4 && (
                                <span className="rounded-full border border-dashed border-[#E7E0D5] px-2.5 py-1 text-[11px] font-semibold text-[#6F675E]">
                                  +{asn.requirements.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right: Budget & Action Box */}
                        <div className="sm:text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 border-t sm:border-t-0 border-[#E7E0D5] pt-3 sm:pt-0">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[#A39A8F]">
                              Estimated Escrow
                            </div>
                            <div className="font-heading font-black text-base sm:text-lg text-[#14110F]">
                              {isBudgetRange
                                ? `${formatMinorUnitsToCurrency(asn.budgetMin, asn.currency)} - ${formatMinorUnitsToCurrency(asn.budgetMax, asn.currency)}`
                                : formatMinorUnitsToCurrency(asn.budgetMin, asn.currency)}
                            </div>
                            <div className="text-[10px] font-semibold text-[#6F675E]">
                              {asn.budgetType}
                            </div>
                          </div>

                          <Link href={`/assignments/${asn.id}`}>
                            <button className="flex items-center gap-1.5 rounded-full bg-[#14110F] group-hover:bg-[#FFD64A] group-hover:text-[#14110F] px-4 py-2 text-xs font-bold text-[#FFFFFF] transition-all shadow-2xs">
                              View Brief
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </Link>
                        </div>
                      </div>

                      {/* Card Footer: Deadline & Timeline */}
                      <div className="mt-4 pt-3 border-t border-[#F2ECE1] flex items-center justify-between text-[11px] text-[#A39A8F]">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-[#6F675E]" />
                          Deadline:{' '}
                          {new Date(asn.deadline).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        <span>
                          Brief ID: <code className="font-mono">{asn.id.slice(0, 8)}</code>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
