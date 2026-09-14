'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Button, Input } from '@creatorconnect/ui';
import {
  Search,
  Filter,
  Sparkles,
  Calendar,
  MapPin,
  CheckCircle2,
  Briefcase,
  Users,
  ArrowRight,
  AlertCircle,
  Loader2,
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
    <div className="container max-w-7xl px-4 sm:px-8 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/60 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="default" className="gap-1.5 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              <span>Full-Text & Typo-Tolerant Discovery</span>
            </Badge>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-5xl tracking-tight">
            Discover Verified Talent & Briefs
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-2 max-w-2xl">
            PostgreSQL trigram-boosted search across top-rated creators, technical specialists, and
            high-budget brand assignments.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl border border-border/50 self-start md:self-auto">
          <Button
            variant={tab === 'creators' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('creators')}
            className="gap-2 rounded-lg"
          >
            <Users className="h-4 w-4" />
            <span>Creators & Talent</span>
          </Button>
          <Button
            variant={tab === 'assignments' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('assignments')}
            className="gap-2 rounded-lg"
          >
            <Briefcase className="h-4 w-4" />
            <span>Brand Briefs</span>
          </Button>
        </div>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === 'creators'
                ? 'Search creators by skills, bio, tagline, city (e.g. video editor, Bengaluru)...'
                : 'Search brand briefs by keywords, requirements (e.g. YouTube series)...'
            }
            className="pl-10 h-12 bg-card/60 backdrop-blur-sm border-border/60 text-sm"
          />
        </div>
        <Button type="submit" className="h-12 px-6 gap-2 shadow-sm font-medium">
          <Filter className="h-4 w-4" />
          <span>Search</span>
        </Button>
      </form>

      {/* Error state */}
      {error && (
        <Card
          glass
          className="p-6 border-destructive/40 bg-destructive/5 text-destructive flex items-center gap-3"
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-1 text-sm font-medium">{error}</div>
          <Button variant="outline" size="sm" onClick={() => fetchDiscovery()}>
            Retry
          </Button>
        </Card>
      )}

      {/* Loading state skeleton */}
      {loading && creators.length === 0 && assignments.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} glass className="p-6 space-y-4 animate-pulse">
              <div className="h-6 bg-muted/60 rounded-md w-3/4" />
              <div className="h-4 bg-muted/40 rounded-md w-1/2" />
              <div className="h-16 bg-muted/20 rounded-md" />
              <div className="h-8 bg-muted/40 rounded-md" />
            </Card>
          ))}
        </div>
      )}

      {/* Content grid: Creators */}
      {tab === 'creators' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creators.map((c) => (
            <Card
              key={c.id}
              glass
              className="p-6 flex flex-col justify-between hover:border-primary/50 transition-all duration-200 group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-heading font-bold text-lg group-hover:text-primary transition-colors">
                      {c.user?.firstName || 'Creator'} {c.user?.lastName || ''}
                    </h3>
                    {c.locationCity && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {c.locationCity}, {c.locationCountry}
                        </span>
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0 font-medium">
                    {c.completionScore}% Complete
                  </Badge>
                </div>

                <p className="text-sm font-medium text-foreground/90 line-clamp-2">
                  {c.tagline || 'Verified Creator on CreatorConnect'}
                </p>

                {c.bio && <p className="text-xs text-muted-foreground line-clamp-3">{c.bio}</p>}

                {c.categories && c.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.categories.map((cat) => (
                      <Badge key={cat.id} variant="outline" className="text-[11px]">
                        {cat.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-6 mt-4 border-t border-border/40 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-muted-foreground">Starting at </span>
                  <span className="font-bold text-foreground">
                    ₹{c.startingRate ? c.startingRate.toLocaleString('en-IN') : 'Negotiable'}
                  </span>
                </div>
                <Link href={`/profiles/${c.userId}`}>
                  <Button size="sm" variant="ghost" className="gap-1 text-xs font-semibold">
                    <span>View Profile</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Content grid: Assignments */}
      {tab === 'assignments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((a) => (
            <Card
              key={a.id}
              glass
              className="p-6 flex flex-col justify-between hover:border-primary/50 transition-all duration-200 group"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <Badge variant="default" className="text-xs font-semibold">
                    {a.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 text-warning" />
                    <span>Due {new Date(a.deadline).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-heading font-bold text-lg group-hover:text-primary transition-colors">
                    {a.title}
                  </h3>
                  <div className="text-xs font-medium text-muted-foreground mt-0.5">
                    by {a.brand?.companyName || 'Verified Brand'}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-3">{a.description}</p>

                {a.requirements && a.requirements.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Key Deliverables
                    </div>
                    {a.requirements.slice(0, 2).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-1.5 text-xs text-foreground/80"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                        <span className="truncate">{r.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-6 mt-4 border-t border-border/40 flex items-center justify-between">
                <div className="text-xs">
                  <span className="text-muted-foreground">Budget: </span>
                  <span className="font-bold text-foreground">
                    ₹{a.budgetMin?.toLocaleString('en-IN') || '0'} - ₹
                    {a.budgetMax?.toLocaleString('en-IN') || 'Flexible'}
                  </span>
                </div>
                <Link href={`/assignments/${a.id}`}>
                  <Button size="sm" className="gap-1.5 text-xs shadow-sm font-semibold">
                    <span>View & Apply</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading &&
        ((tab === 'creators' && creators.length === 0) ||
          (tab === 'assignments' && assignments.length === 0)) && (
          <Card glass className="p-12 text-center space-y-4 border-border/60">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="font-heading font-bold text-xl">No matching results found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              We couldn&apos;t find anything matching your search. Try changing keywords or clearing
              filters.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setQuery('');
                fetchDiscovery();
              }}
            >
              Clear Search Query
            </Button>
          </Card>
        )}

      {/* Keyset Cursor Pagination Button */}
      {nextCursor && (
        <div className="flex justify-center pt-6">
          <Button
            variant="outline"
            onClick={() => fetchDiscovery(nextCursor)}
            disabled={loading}
            className="gap-2 px-8 h-11"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            <span>Load More Results</span>
          </Button>
        </div>
      )}
    </div>
  );
}
