'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

interface CreatorItem {
  id: string;
  userId: string;
  tagline: string | null;
  bio: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  startingRate: number | null;
  currency: string;
  completionScore: number;
  categories: { id: string; name: string }[];
  user: {
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  };
}

interface AssignmentItem {
  id: string;
  brandId: string;
  title: string;
  description: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  deadline: string;
  status: string;
  requirements: { id: string; title: string; isMandatory: boolean }[];
  brand: {
    companyName: string;
  };
}

export default function DiscoveryPage() {
  const [tab, setTab] = useState<'creators' | 'assignments'>('creators');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creators, setCreators] = useState<CreatorItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchDiscovery = async (cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint =
        tab === 'creators' ? '/api/v1/discovery/creators' : '/api/v1/discovery/assignments';
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load discovery results');
      }
      const data = await res.json();
      if (tab === 'creators') {
        setCreators(cursor ? (prev) => [...prev, ...data.items] : data.items);
      } else {
        setAssignments(cursor ? (prev) => [...prev, ...data.items] : data.items);
      }
      setNextCursor(data.nextCursor);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscovery();
  }, [tab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDiscovery();
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#121212] py-10 px-4 sm:px-8">
      <div className="container max-w-7xl mx-auto space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-[#EAE3D5] pb-8">
          <div>
            <CapsuleBadge variant="amber" className="mb-3">
              • INDIA&apos;S NETWORK • DISCOVERY
            </CapsuleBadge>
            <h1 className="font-heading font-extrabold text-3xl sm:text-5xl tracking-tight text-[#121212]">
              Discover verified{' '}
              <span className="font-serif italic font-normal text-[#121212]">talent & briefs.</span>
            </h1>
            <p className="text-[#5C564E] text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              PostgreSQL trigram-boosted search across top-rated creators, technical specialists,
              and high-budget brand campaigns.
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-[#EFE9DF] p-1.5 rounded-full border border-[#E2DBD0] self-start md:self-auto">
            <button
              onClick={() => setTab('creators')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                tab === 'creators'
                  ? 'bg-white text-[#121212] shadow-2xs'
                  : 'text-[#6B655C] hover:text-[#121212]'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Creators & Talent</span>
            </button>
            <button
              onClick={() => setTab('assignments')}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold transition-all ${
                tab === 'assignments'
                  ? 'bg-white text-[#121212] shadow-2xs'
                  : 'text-[#6B655C] hover:text-[#121212]'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Brand Briefs</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8C8479]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'creators'
                  ? 'Search creators by skills, bio, tagline, city (e.g. video editor, Bengaluru)...'
                  : 'Search brand briefs by keywords, requirements (e.g. YouTube series)...'
              }
              className="w-full pl-11 pr-4 h-12 bg-white rounded-full border border-[#D9D2C5] text-sm font-medium text-[#121212] outline-none focus:ring-2 focus:ring-[#FFCE38] focus:border-transparent transition-all shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-7 rounded-full bg-[#FFCE38] hover:bg-[#F5C32C] text-[#121212] font-semibold text-sm shadow-sm inline-flex items-center gap-2 transition-all shrink-0"
          >
            <Filter className="h-4 w-4" />
            <span>Search</span>
          </button>
        </form>

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button
              onClick={() => fetchDiscovery()}
              className="px-3 py-1 bg-white border border-red-200 rounded-full font-semibold hover:bg-red-50"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state skeleton */}
        {loading && creators.length === 0 && assignments.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-[#EDE7DE] space-y-4 animate-pulse shadow-2xs"
              >
                <div className="h-6 bg-[#F2ECE3] rounded-md w-3/4" />
                <div className="h-4 bg-[#F2ECE3] rounded-md w-1/2" />
                <div className="h-16 bg-[#FAF7F2] rounded-md" />
                <div className="h-8 bg-[#F2ECE3] rounded-md" />
              </div>
            ))}
          </div>
        )}

        {/* Content grid: Creators */}
        {tab === 'creators' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-3xl p-6 border border-[#EDE7DE] shadow-2xs hover:shadow-md hover:border-[#D6CEBF] transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading font-bold text-lg text-[#121212]">
                        {c.user?.firstName || 'Creator'} {c.user?.lastName || ''}
                      </h3>
                      {c.locationCity && (
                        <div className="flex items-center gap-1 text-xs text-[#7C756B] mt-0.5">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {c.locationCity}, {c.locationCountry}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="bg-[#FAF7F2] border border-[#EAE3D5] text-[#5C564E] text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0">
                      {c.completionScore}% Profile
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[#121212] line-clamp-2">
                    {c.tagline || 'Verified Creator on CreatorConnect'}
                  </p>

                  {c.bio && (
                    <p className="text-xs text-[#6B655C] line-clamp-3 leading-relaxed">{c.bio}</p>
                  )}

                  {c.categories && c.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {c.categories.map((cat) => (
                        <span
                          key={cat.id}
                          className="bg-[#FAF7F2] border border-[#EAE3D5] text-[#5C564E] text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-6 mt-4 border-t border-[#EAE3D5] flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-[#8C8479]">Starting at </span>
                    <span className="font-bold text-[#121212]">
                      ₹{c.startingRate ? c.startingRate.toLocaleString('en-IN') : 'Negotiable'}
                    </span>
                  </div>
                  <Link
                    href={`/profiles/${c.userId}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#121212] hover:underline"
                  >
                    <span>View Profile</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content grid: Assignments */}
        {tab === 'assignments' && (
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
                      by {a.brand?.companyName || 'Verified Brand'}
                    </div>
                  </div>

                  <p className="text-xs text-[#6B655C] line-clamp-3 leading-relaxed">
                    {a.description}
                  </p>

                  {a.requirements && a.requirements.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold text-[#8C8479] uppercase tracking-wider">
                        Key Deliverables
                      </div>
                      {a.requirements.slice(0, 2).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-1.5 text-xs text-[#5C564E]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1B7339] shrink-0" />
                          <span className="truncate">{r.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
                We couldn&apos;t find anything matching your search. Try changing keywords or
                clearing filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  fetchDiscovery();
                }}
                className="px-6 py-2.5 rounded-full border border-[#D9D2C5] text-xs font-semibold hover:bg-[#FAF7F2] transition-colors"
              >
                Clear Search Query
              </button>
            </div>
          )}

        {/* Keyset Cursor Pagination Button */}
        {nextCursor && (
          <div className="flex justify-center pt-6">
            <button
              onClick={() => fetchDiscovery(nextCursor)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-[#D9D2C5] bg-white hover:bg-[#FAF7F2] text-xs font-semibold text-[#121212] shadow-2xs transition-all"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
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
