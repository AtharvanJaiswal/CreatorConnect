'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../providers/auth-provider';
import { communityFrontendService } from '../../services/community.service';
import {
  Users,
  MapPin,
  Calendar,
  Briefcase,
  MessageSquare,
  Sparkles,
  Shield,
  Plus,
  Heart,
  ArrowRight,
  ExternalLink,
  Lock,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  WifiOff,
} from 'lucide-react';

interface Post {
  id: string;
  type: 'announcement' | 'opportunity' | 'discussion' | 'event' | 'question';
  title: string;
  body: string;
  author: {
    name: string;
    role: string;
    verified: boolean;
    initials: string;
    avatarBg: string;
  };
  timeAgo: string;
  applauds: number;
  commentsCount: number;
  tags: string[];
  pinned?: boolean | undefined;
  linkedAssignment?:
    | {
        id: string;
        title: string;
        escrowAmount?: string | undefined;
        slots?: string | undefined;
      }
    | undefined;
  eventDetails?:
    | {
        date: string;
        time: string;
        venue: string;
        rsvpCount: number;
      }
    | undefined;
}

const INITIAL_POSTS: Post[] = [
  {
    id: 'post-1',
    type: 'announcement',
    pinned: true,
    title:
      'Welcome to the Mumbai Summer Creative Collective: Rules, monthly meetups & local gear pooling',
    body: 'Welcome to our shared space. Remember to tag your posts accurately: use [Opportunity] for paid briefs only, [Event] for local workshops, and [Question] for equipment or production advice. No uncontracted solicitation. Platform escrow is mandatory for direct hires.',
    author: {
      name: 'Aarav Mehta',
      role: 'Community Guide • Film & Broadcast',
      verified: true,
      initials: 'AM',
      avatarBg: 'bg-[#C9B6F7]',
    },
    timeAgo: '2 days ago',
    applauds: 88,
    commentsCount: 42,
    tags: ['Rules', 'Gear Pool', 'Meetups'],
  },
  {
    id: 'post-2',
    type: 'opportunity',
    title: 'Need 2x Ronin 4D Focus Pullers for 3-day monsoon lookbook shoot in South Bombay',
    body: 'Looking for experienced focus pullers familiar with DJI Transmission and Ronin 4D wireless rigs. Dates: June 4–6. Compensation: ₹18,000 / day. Contract managed via platform escrow with travel and meals covered.',
    author: {
      name: 'Ananya V.',
      role: 'Studio Atelier • Brand Partner',
      verified: true,
      initials: 'AV',
      avatarBg: 'bg-[#FFB6C8]',
    },
    timeAgo: '4 hours ago',
    applauds: 34,
    commentsCount: 16,
    tags: ['Cinematography', 'Ronin 4D', 'South Bombay'],
    linkedAssignment: {
      id: 'PRJ-9012',
      title: 'Monsoon Lookbook 2026 Focus Operation',
      escrowAmount: '₹54,000 Total Escrow Funded',
      slots: '3 Slots Total',
    },
  },
  {
    id: 'post-3',
    type: 'event',
    title: 'Mumbai Creators Monsoon Mixer: Live Gear Testing & Podcasting Panel at Bandra Base',
    body: 'Join 50+ local creators for an evening of hands-on cinema camera shootouts, acoustic treatment workshops for indie podcasters, and peer networking. Refreshments and equipment testing tables provided.',
    author: {
      name: 'Kavya Nair',
      role: 'Creative Director • Studio Atelier',
      verified: true,
      initials: 'KN',
      avatarBg: 'bg-[#FFD64A]',
    },
    timeAgo: '1 day ago',
    applauds: 62,
    commentsCount: 29,
    tags: ['Workshop', 'Bandra', 'Audio Production'],
    eventDetails: {
      date: 'Saturday, June 14, 2026',
      time: '4:00 PM – 8:00 PM IST',
      venue: 'Bandra Base, 29th Road, Bandra West, Mumbai',
      rsvpCount: 48,
    },
  },
  {
    id: 'post-4',
    type: 'question',
    title: 'Best rental houses for Arri Alexa Mini LF in Andheri West with verified insurance?',
    body: 'Planning a high-speed commercial shoot next Tuesday. Need a reliable rental vendor in Andheri West or Versova who provides complete Cooke Panchro primes and comprehensive platform-backed transit insurance.',
    author: {
      name: 'Rohan Deshmukh',
      role: 'Cinematographer • Indie Collective',
      verified: false,
      initials: 'RD',
      avatarBg: 'bg-[#B6E09B]',
    },
    timeAgo: '6 hours ago',
    applauds: 19,
    commentsCount: 12,
    tags: ['Gear Rental', 'Andheri West', 'Alexa Mini LF'],
  },
];

const LOCAL_EVENTS = [
  {
    id: 'evt-1',
    title: 'Monsoon Mixer & Gear Shootout',
    date: 'Sat, Jun 14 • 4:00 PM',
    venue: 'Bandra Base, Bandra West',
    rsvps: 48,
  },
  {
    id: 'evt-2',
    title: 'Davinci Resolve Color Grading Masterclass',
    date: 'Sun, Jun 22 • 2:00 PM',
    venue: 'Flame Studios, Khar',
    rsvps: 32,
  },
];

const ACTIVE_OPPORTUNITIES = [
  {
    id: 'PRJ-9012',
    title: 'Ronin 4D Focus Puller (3 Days)',
    budget: '₹54,000 Escrow',
    brand: 'Studio Atelier',
    slots: '2 open',
  },
  {
    id: 'PRJ-8841',
    title: 'Commercial Sound Recordist',
    budget: '₹35,000 Escrow',
    brand: 'Verve Media',
    slots: '1 open',
  },
];

const FEATURED_MEMBERS = [
  {
    name: 'Aarav Mehta',
    role: 'Director of Photography',
    badge: 'Guide',
    avatar: 'AM',
    bg: 'bg-[#C9B6F7]',
  },
  {
    name: 'Priya Sharma',
    role: 'Colorist & Finishing Artist',
    badge: 'Pro Verified',
    avatar: 'PS',
    bg: 'bg-[#B6E09B]',
  },
  {
    name: 'Kabir Varma',
    role: 'Commercial Podcaster',
    badge: 'Top Creator',
    avatar: 'KV',
    bg: 'bg-[#FFB6C8]',
  },
];

export default function CommunityPage() {
  const { user, accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'all' | 'opportunities' | 'events' | 'discussions' | 'members' | 'following' | 'moderation'
  >('all');
  const [activeCity, setActiveCity] = useState<'Mumbai' | 'Bengaluru' | 'Delhi-NCR' | 'Goa'>(
    'Mumbai',
  );
  const [qaState, setQaState] = useState<
    'default' | 'skeletons' | 'empty' | 'error' | 'hidden-post' | 'brand-limit'
  >('default');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [brandLimitDismissed, setBrandLimitDismissed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Post Form State
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostBody, setNewPostBody] = useState('');
  const [newPostType, setNewPostType] = useState<
    'discussion' | 'opportunity' | 'event' | 'question'
  >('discussion');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [apiPosts, setApiPosts] = useState<Post[]>([]);
  const [hasLoadedLive, setHasLoadedLive] = useState(false);

  // Live API Fetch Effect
  useEffect(() => {
    let isMounted = true;
    const fetchLiveFeed = async () => {
      try {
        const typeFilter =
          activeTab === 'opportunities'
            ? 'OPPORTUNITY'
            : activeTab === 'events'
              ? 'EVENT'
              : activeTab === 'discussions'
                ? 'DISCUSSION'
                : undefined;

        const res = await communityFrontendService.getPosts(
          { city: activeCity, type: typeFilter },
          accessToken,
        );

        if (isMounted && res.items) {
          const mapped: Post[] = res.items.map((item) => ({
            id: item.id,
            type: item.type.toLowerCase() as any,
            title: item.title,
            body: item.body,
            author: {
              name: item.author.name,
              role: item.author.role || 'Community Creator',
              verified: item.author.isVerified,
              initials: item.author.initials,
              avatarBg: 'bg-[#C9B6F7]',
            },
            timeAgo: 'Recently',
            applauds: item.applaudsCount,
            commentsCount: item.commentsCount,
            tags: item.tags,
            pinned: item.isPinned,
            linkedAssignment: item.linkedAssignment
              ? {
                  id: item.linkedAssignment.id,
                  title: item.linkedAssignment.title,
                  escrowAmount: `₹${item.linkedAssignment.budgetMin.toLocaleString()} Escrow`,
                  slots: 'Active',
                }
              : undefined,
            eventDetails: item.linkedEvent
              ? {
                  date: new Date(item.linkedEvent.eventDate).toLocaleDateString(),
                  time: new Date(item.linkedEvent.eventDate).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                  venue: item.linkedEvent.venue,
                  rsvpCount: item.linkedEvent.rsvpCount,
                }
              : undefined,
          }));

          setApiPosts(mapped);
          setHasLoadedLive(true);
        }
      } catch {
        // Fallback gracefully to demo fixtures if network/API unavailable
      }
    };

    fetchLiveFeed();
    return () => {
      isMounted = false;
    };
  }, [activeCity, activeTab, accessToken]);

  const handleApplaud = async (id: string) => {
    // Optimistic state update
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, applauds: p.applauds + 1 } : p)));
    setApiPosts((prev) => prev.map((p) => (p.id === id ? { ...p, applauds: p.applauds + 1 } : p)));

    if (accessToken) {
      try {
        await communityFrontendService.applaudPost(id, accessToken);
      } catch {
        // Ignored
      }
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostBody.trim()) return;

    setIsSubmitting(true);
    try {
      if (accessToken) {
        const created = await communityFrontendService.createPost(
          {
            title: newPostTitle.trim(),
            body: newPostBody.trim(),
            type: newPostType.toUpperCase() as any,
            city: activeCity,
            tags: [newPostType.toUpperCase(), activeCity],
          },
          accessToken,
        );

        const mapped: Post = {
          id: created.id,
          type: created.type.toLowerCase() as any,
          title: created.title,
          body: created.body,
          author: {
            name: created.author.name,
            role: created.author.role || 'Creator',
            verified: created.author.isVerified,
            initials: created.author.initials,
            avatarBg: 'bg-[#FFD64A]',
          },
          timeAgo: 'Just now',
          applauds: created.applaudsCount,
          commentsCount: 0,
          tags: created.tags,
        };

        setApiPosts((prev) => [mapped, ...prev]);
        setPosts((prev) => [mapped, ...prev]);
      } else {
        const fallbackCreated: Post = {
          id: `post-${Date.now()}`,
          type: newPostType,
          title: newPostTitle,
          body: newPostBody,
          author: {
            name: user
              ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'You'
              : 'Kavya Nair',
            role: 'Creative Director • Studio Atelier',
            verified: true,
            initials: 'KN',
            avatarBg: 'bg-[#FFD64A]',
          },
          timeAgo: 'Just now',
          applauds: 1,
          commentsCount: 0,
          tags: [newPostType.toUpperCase(), activeCity],
        };
        setPosts([fallbackCreated, ...posts]);
        setApiPosts((prev) => [fallbackCreated, ...prev]);
      }

      setNewPostTitle('');
      setNewPostBody('');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to publish post');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine active feed: prefer live API posts if loaded and present, else fixtures
  const currentPosts = hasLoadedLive && apiPosts.length > 0 ? apiPosts : posts;

  // Filter posts based on tab
  const filteredPosts = currentPosts.filter((post) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'opportunities') return post.type === 'opportunity';
    if (activeTab === 'events') return post.type === 'event';
    if (activeTab === 'discussions')
      return post.type === 'discussion' || post.type === 'announcement' || post.type === 'question';
    if (activeTab === 'following') return post.pinned || post.author.verified;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col font-sans selection:bg-[#FFD64A] selection:text-[#14110F]">
      {/* QA Simulation Rig Bar */}
      <aside
        aria-label="QA Simulation Rig"
        className="w-full bg-[#EFE6E3] border-b border-[#E7E0D5] px-4 sm:px-8 py-2 z-30"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#725C00] animate-pulse" />
            <span className="font-bold uppercase tracking-wider text-[#4D4634]">
              QA Simulation Rig • Module J Community Hub (J01–J10)
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5" role="tablist">
            {(
              [
                { id: 'default', label: 'Default Feed' },
                { id: 'skeletons', label: 'Loading Skeletons' },
                { id: 'empty', label: 'First-Use Empty' },
                { id: 'error', label: 'Feed Error' },
                { id: 'hidden-post', label: 'Hidden Post Notice' },
                { id: 'brand-limit', label: 'Brand Promo Limit' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                role="tab"
                aria-selected={qaState === st.id}
                onClick={() => setQaState(st.id)}
                className={`px-3 py-1 rounded-full font-bold uppercase text-[11px] tracking-wider transition-all ${
                  qaState === st.id
                    ? 'bg-[#14110F] text-[#FAF6EF] shadow-sm'
                    : 'bg-white/80 hover:bg-white text-[#4D4634] border border-[#E7E0D5]'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Conditional System Alert: Brand Promo Limit Notice */}
        {(qaState === 'brand-limit' || (!brandLimitDismissed && qaState === 'default')) && (
          <div
            id="brand-limit-alert"
            className="rounded-2xl bg-[#D0BCFE]/30 border border-[#BFA7F2] p-4 flex items-start justify-between gap-4 transition-all"
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#65558F] mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-sm text-[#14110F]">
                  Brand Monthly Promotion Quota Active
                </h4>
                <p className="text-xs text-[#4D4634] mt-0.5">
                  Your studio account has used <strong className="text-[#14110F]">2 of 3</strong>{' '}
                  monthly community opportunity posts for Mumbai. Next post quota resets on June 1,
                  2026. Standard community interactions, discussions, and gear pooling remain
                  unlimited.
                </p>
              </div>
            </div>
            <button
              onClick={() => setBrandLimitDismissed(true)}
              className="text-[#6F675E] hover:text-[#14110F] p-1 rounded-full hover:bg-black/5"
              aria-label="Dismiss quota notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Hidden Post Moderation Notice */}
        {qaState === 'hidden-post' && (
          <div className="rounded-2xl bg-[#FFDAD6] border border-[#FFB4AB] p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#BA1A1A] mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-[#410002]">Post Under Moderator Review</h4>
              <p className="text-xs text-[#410002]/80 mt-0.5">
                This discussion dispatch has been temporarily hidden following 3 peer flags
                regarding uncontracted commercial solicitation. The trust desk is currently
                reviewing the submission against Community Guideline 4.
              </p>
            </div>
          </div>
        )}

        {/* J01 Header Banner: Neo-Graphic Editorial Surface */}
        <header className="w-full rounded-3xl bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-2xl">
              {/* Breadcrumb */}
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-xs text-[#6F675E]"
              >
                <Link href="/" className="hover:text-[#14110F] transition-colors">
                  Home
                </Link>
                <span>/</span>
                <span className="text-[#14110F] font-bold">Community</span>
                <span>/</span>
                <span className="text-[#6F675E]">{activeCity} Hub</span>
              </nav>

              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#14110F]">
                  {activeCity} Creators Hub
                </h1>
                <span className="font-serif italic text-xl text-[#725C00]">
                  Active local collective
                </span>
              </div>

              <p className="text-sm text-[#4D4634] leading-relaxed">
                Cross-disciplinary forum connecting directors, cinematographers, podcasters,
                colorists, and brands across Bandra, Andheri & Lower Parel.
              </p>

              {/* Hub Metadata Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF2EE] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F]">
                  <MapPin className="w-3.5 h-3.5 text-[#864D5D]" /> {activeCity}, MH
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF2EE] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F]">
                  <Users className="w-3.5 h-3.5 text-[#65558F]" /> 1,842 Members
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFE6E3] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#4D4634]">
                  <Lock className="w-3.5 h-3.5" /> Primary Hub (Locked)
                </span>
              </div>
            </div>

            {/* Hub Actions & City Switcher */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:self-start">
              {/* City Selector */}
              <div className="relative">
                <select
                  value={activeCity}
                  onChange={(e) => setActiveCity(e.target.value as any)}
                  aria-label="Select community city hub"
                  className="h-11 px-4 py-2 rounded-full bg-[#FAF2EE] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] hover:bg-[#F5ECE8] transition-colors cursor-pointer pr-8"
                >
                  <option value="Mumbai">Mumbai Hub</option>
                  <option value="Bengaluru">Bengaluru Hub</option>
                  <option value="Delhi-NCR">Delhi-NCR Hub</option>
                  <option value="Goa">Goa Hub</option>
                </select>
              </div>

              <button
                onClick={() => setActiveTab('following')}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-[#FAF2EE] hover:bg-[#F5ECE8] border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider text-[#14110F] transition-colors"
              >
                <Sparkles className="w-4 h-4 text-[#725C00]" />
                <span>Hubs & Following</span>
              </button>

              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[2px_2px_0px_#14110F] hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Post</span>
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs Bar */}
        <nav
          aria-label="Community Feed Filter"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E7E0D5]"
        >
          {[
            { id: 'all', label: 'All Feed' },
            { id: 'opportunities', label: 'Opportunities (J02)' },
            { id: 'events', label: 'Events & Meetups (J03)' },
            { id: 'discussions', label: 'Discussions' },
            { id: 'members', label: 'Members (J04)' },
            { id: 'following', label: 'Following (J08)' },
            { id: 'moderation', label: 'Mod Queue (J10)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full font-bold text-xs tracking-wider transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#FFD64A] text-[#14110F] border border-[#14110F] shadow-[1px_1px_0px_#14110F]'
                  : 'text-[#6F675E] hover:text-[#14110F] hover:bg-white/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Main Desktop Layout Grid (68% / 32%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Feed Stream (8 cols of 12) */}
          <main className="lg:col-span-8 flex flex-col gap-6 w-full">
            {/* QA STATE: Error View */}
            {qaState === 'error' && (
              <div className="rounded-3xl bg-white border border-[#FFDAD6] p-8 text-center flex flex-col items-center gap-4 shadow-sm">
                <div className="w-14 h-14 rounded-full bg-[#FFDAD6] flex items-center justify-center text-[#BA1A1A]">
                  <WifiOff className="w-7 h-7" />
                </div>
                <div className="max-w-md">
                  <h3 className="font-bold text-lg text-[#14110F]">
                    Unable to load Mumbai hub feed
                  </h3>
                  <p className="text-sm text-[#4D4634] mt-1">
                    We encountered a network interruption while syncing real-time community
                    dispatches. Your drafted submissions remain preserved.
                  </p>
                </div>
                <button
                  onClick={() => setQaState('default')}
                  className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-[#14110F] text-[#FAF6EF] font-bold text-xs uppercase tracking-wider hover:bg-[#34302D] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Feed</span>
                </button>
              </div>
            )}

            {/* QA STATE: Empty State */}
            {qaState === 'empty' && (
              <div className="rounded-3xl bg-white border border-[#E7E0D5] p-10 text-center flex flex-col items-center gap-4 shadow-sm">
                <div className="w-16 h-16 rounded-2xl bg-[#FFD64A]/30 flex items-center justify-center text-[#725C00]">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <div className="max-w-md flex flex-col gap-1">
                  <h3 className="font-black text-xl text-[#14110F]">Welcome to the Mumbai Hub!</h3>
                  <p className="text-sm text-[#4D4634]">
                    You are among the inaugural members of this verified city collective. Break the
                    ice by introducing your craft, broadcasting a crew opening, or seeking
                    production advice.
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[2px_2px_0px_#14110F]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Start First Conversation</span>
                  </button>
                  <button
                    onClick={() => setQaState('default')}
                    className="h-11 px-5 rounded-full bg-[#FAF2EE] hover:bg-[#F5ECE8] text-[#14110F] font-bold text-xs uppercase tracking-wider border border-[#E7E0D5]"
                  >
                    View Demo Feed
                  </button>
                </div>
              </div>
            )}

            {/* QA STATE: Loading Skeletons */}
            {qaState === 'skeletons' && (
              <div className="flex flex-col gap-6 animate-pulse w-full">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#EFE6E3]" />
                      <div className="flex flex-col gap-2 flex-1">
                        <div className="h-4 bg-[#EFE6E3] rounded w-1/4" />
                        <div className="h-3 bg-[#FAF2EE] rounded w-1/6" />
                      </div>
                    </div>
                    <div className="h-6 bg-[#EFE6E3] rounded w-4/5" />
                    <div className="h-4 bg-[#FAF2EE] rounded w-full" />
                    <div className="h-4 bg-[#FAF2EE] rounded w-3/4" />
                    <div className="h-10 bg-[#FAF2EE] rounded-xl w-1/3 mt-2" />
                  </div>
                ))}
              </div>
            )}

            {/* DEFAULT FEED STREAM */}
            {qaState !== 'skeletons' && qaState !== 'empty' && qaState !== 'error' && (
              <div className="flex flex-col gap-6 w-full">
                {activeTab === 'moderation' ? (
                  /* J10 Moderator Tools Panel */
                  <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-4">
                      <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-[#725C00]" />
                        <div>
                          <h3 className="font-bold text-base text-[#14110F]">
                            Community Moderation Queue (J10)
                          </h3>
                          <p className="text-xs text-[#6F675E]">
                            Manage flagged dispatches, solicitations, and guideline compliance
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-[#FFB6C8] font-bold text-xs uppercase tracking-wider text-[#14110F]">
                        2 Pending Flags
                      </span>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="p-4 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#D8483C] uppercase">
                            Flagged: Uncontracted Solicitation
                          </span>
                          <span className="text-[#6F675E]">Reported 20m ago by 3 users</span>
                        </div>
                        <p className="text-sm font-semibold text-[#14110F]">
                          &quot;DM me on Telegram for crypto video editing gig — high payouts, no
                          escrow needed.&quot;
                        </p>
                        <div className="flex items-center gap-3 pt-2">
                          <button className="px-4 py-1.5 rounded-full bg-[#BA1A1A] text-white font-bold text-xs uppercase tracking-wider">
                            Hide Post & Warn User
                          </button>
                          <button className="px-4 py-1.5 rounded-full bg-white border border-[#E7E0D5] font-bold text-xs uppercase tracking-wider text-[#14110F]">
                            Dismiss Flag
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeTab === 'members' ? (
                  /* J04 Community Members Directory */
                  <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-4">
                      <div>
                        <h3 className="font-bold text-base text-[#14110F]">
                          Mumbai Verified Creative Directory (J04)
                        </h3>
                        <p className="text-xs text-[#6F675E]">
                          Browse 1,842 local cinematographers, podcasters, directors and brands
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {FEATURED_MEMBERS.map((member) => (
                        <div
                          key={member.name}
                          className="p-4 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full ${member.bg} flex items-center justify-center font-bold text-xs text-[#14110F]`}
                            >
                              {member.avatar}
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-[#14110F]">{member.name}</h4>
                              <p className="text-xs text-[#6F675E]">{member.role}</p>
                            </div>
                          </div>
                          <button className="px-3 py-1 rounded-full bg-white border border-[#E7E0D5] text-xs font-bold uppercase tracking-wider hover:bg-[#F5ECE8]">
                            Follow
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Posts List */
                  filteredPosts.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-3xl bg-white border border-[#E7E0D5] p-6 shadow-sm hover:translate-y-[-2px] transition-transform relative"
                    >
                      {/* Post Header */}
                      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#FAF2EE]">
                        <div className="flex items-center gap-2">
                          {post.pinned && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFD64A] text-[#14110F] text-[10px] font-bold uppercase tracking-wider border border-[#14110F]">
                              Pinned Announcement
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              post.type === 'opportunity'
                                ? 'bg-[#FFB6C8] text-[#14110F]'
                                : post.type === 'event'
                                  ? 'bg-[#B6E09B] text-[#14110F]'
                                  : 'bg-[#C9B6F7] text-[#14110F]'
                            }`}
                          >
                            {post.type}
                          </span>
                        </div>
                        <span className="text-xs text-[#6F675E]">{post.timeAgo}</span>
                      </div>

                      {/* Author Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-10 h-10 rounded-full ${post.author.avatarBg} flex items-center justify-center font-bold text-sm text-[#14110F] shadow-xs`}
                        >
                          {post.author.initials}
                        </div>
                        <div className="flex flex-col leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-[#14110F]">
                              {post.author.name}
                            </span>
                            {post.author.verified && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#725C00]" />
                            )}
                          </div>
                          <span className="text-xs text-[#6F675E]">{post.author.role}</span>
                        </div>
                      </div>

                      {/* Post Content */}
                      <h2 className="text-lg sm:text-xl font-black text-[#14110F] mb-2 leading-snug">
                        <Link
                          href={`/community/posts/${post.id}`}
                          className="hover:text-[#725C00] transition-colors"
                        >
                          {post.title}
                        </Link>
                      </h2>

                      <p className="text-sm text-[#4D4634] leading-relaxed mb-4">{post.body}</p>

                      {/* Linked Assignment Box (J02) */}
                      {post.linkedAssignment && (
                        <div className="mb-4 p-4 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#FFD64A] border border-[#14110F] flex items-center justify-center text-[#14110F] shrink-0">
                              <Shield className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs uppercase tracking-wider text-[#14110F]">
                                Verified Assignment #{post.linkedAssignment.id}
                              </span>
                              <span className="font-bold text-xs text-[#725C00]">
                                {post.linkedAssignment.escrowAmount}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded bg-[#EFE6E3] text-[10px] font-bold uppercase tracking-wider text-[#6F675E]">
                              {post.linkedAssignment.slots}
                            </span>
                            <Link
                              href={`/assignments/${post.linkedAssignment.id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border border-[#14110F] shadow-[1px_1px_0px_#14110F] hover:brightness-95 transition-all"
                            >
                              <span>Apply via Escrow</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      )}

                      {/* Event Banner Box (J03) */}
                      {post.eventDetails && (
                        <div className="mb-4 p-4 rounded-2xl bg-[#B6E09B]/20 border border-[#9DD47A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#B6E09B] border border-[#14110F] flex items-center justify-center text-[#14110F] shrink-0">
                              <Calendar className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-xs text-[#14110F]">
                                {post.eventDetails.date} • {post.eventDetails.time}
                              </span>
                              <span className="text-xs text-[#6F675E]">
                                {post.eventDetails.venue}
                              </span>
                            </div>
                          </div>
                          <Link
                            href={`/community/events/${post.id}`}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-[#14110F] text-white font-bold text-xs uppercase tracking-wider hover:bg-[#34302D] transition-colors"
                          >
                            <span>RSVP ({post.eventDetails.rsvpCount} Attending)</span>
                          </Link>
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#FAF2EE]">
                        <div className="flex items-center gap-4 text-xs font-bold text-[#6F675E]">
                          <button
                            onClick={() => handleApplaud(post.id)}
                            className="inline-flex items-center gap-1.5 hover:text-[#BA1A1A] transition-colors cursor-pointer"
                            aria-label={`Applaud post by ${post.author.name}`}
                          >
                            <Heart className="w-4 h-4 text-[#BA1A1A]" />
                            <span>{post.applauds} Applauds</span>
                          </button>

                          <Link
                            href={`/community/posts/${post.id}`}
                            className="inline-flex items-center gap-1.5 hover:text-[#14110F] transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>{post.commentsCount} Comments</span>
                          </Link>
                        </div>

                        <Link
                          href={`/community/posts/${post.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#725C00] hover:text-[#14110F] transition-colors"
                        >
                          <span>Open Discussion</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </main>

          {/* RIGHT COLUMN: Community Sidebar (4 cols of 12) */}
          <aside className="lg:col-span-4 flex flex-col gap-6 w-full">
            {/* J03 Upcoming Local Events */}
            <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#14110F] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#725C00]" />
                  <span>Local Meetups (J03)</span>
                </h3>
                <Link
                  href="/community/events"
                  className="text-xs font-bold text-[#725C00] hover:underline"
                >
                  All
                </Link>
              </div>

              <div className="flex flex-col gap-3">
                {LOCAL_EVENTS.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex flex-col gap-1.5"
                  >
                    <h4 className="font-bold text-xs text-[#14110F] leading-snug">{evt.title}</h4>
                    <p className="text-[11px] text-[#6F675E]">{evt.date}</p>
                    <p className="text-[11px] text-[#A39A8F]">{evt.venue}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px] font-bold">
                      <span className="text-[#65558F]">{evt.rsvps} Creators Going</span>
                      <Link
                        href={`/community/events/${evt.id}`}
                        className="text-[#14110F] hover:underline"
                      >
                        Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* J02 Active Community Opportunities */}
            <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider text-[#14110F] flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#725C00]" />
                  <span>Gig Board (J02)</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#FFD64A] text-[10px] font-bold text-[#14110F]">
                  Escrow Verified
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {ACTIVE_OPPORTUNITIES.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3.5 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#6F675E] uppercase">
                        {opp.brand}
                      </span>
                      <span className="text-[10px] font-bold text-[#2E9E6B]">{opp.slots}</span>
                    </div>
                    <h4 className="font-bold text-xs text-[#14110F]">{opp.title}</h4>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-black text-[#14110F]">{opp.budget}</span>
                      <Link
                        href={`/assignments/${opp.id}`}
                        className="text-xs font-bold text-[#725C00] hover:underline"
                      >
                        Apply →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* J04 Featured Local Talent */}
            <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 flex flex-col gap-4 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-wider text-[#14110F] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#725C00]" />
                <span>Featured Talent (J04)</span>
              </h3>

              <div className="flex flex-col gap-3">
                {FEATURED_MEMBERS.map((m) => (
                  <div key={m.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full ${m.bg} flex items-center justify-center font-bold text-xs text-[#14110F]`}
                      >
                        {m.avatar}
                      </div>
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold text-xs text-[#14110F]">{m.name}</span>
                        <span className="text-[10px] text-[#6F675E]">{m.role}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#FAF2EE] text-[10px] font-bold text-[#4D4634] uppercase tracking-wider">
                      {m.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Guidelines & Safety Box */}
            <div className="rounded-3xl bg-[#FAF2EE] border border-[#E7E0D5] p-6 flex flex-col gap-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#14110F]">
                Community Code of Conduct
              </h4>
              <p className="text-xs text-[#6F675E] leading-relaxed">
                Paid opportunities require platform escrow integration. No unpaid work solicitation,
                piracy of proprietary LUTs/plugins, or harassment.
              </p>
              <Link
                href="/consent"
                className="text-xs font-bold text-[#725C00] hover:underline mt-1"
              >
                Read Community Terms →
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* J06 Create Post Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#E7E0D5] shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#E7E0D5] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#725C00]" />
                <h3 className="font-black text-lg text-[#14110F]">
                  Create Community Dispatch (J06)
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#6F675E] hover:text-[#14110F] p-1 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5">
                  Dispatch Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['discussion', 'opportunity', 'event', 'question'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewPostType(cat)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                        newPostType === cat
                          ? 'bg-[#FFD64A] text-[#14110F] border-2 border-[#14110F] shadow-[1px_1px_0px_#14110F]'
                          : 'bg-[#FAF2EE] text-[#6F675E] border border-[#E7E0D5] hover:bg-[#F5ECE8]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5">
                  Headline
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Looking for Ronin 4D Focus Puller in Bandra..."
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-[#FAF2EE] border border-[#E7E0D5] text-sm text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#6F675E] mb-1.5">
                  Body & Terms
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe the production brief, gear specs, or question details..."
                  value={newPostBody}
                  onChange={(e) => setNewPostBody(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-[#FAF2EE] border border-[#E7E0D5] text-sm text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7E0D5]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider text-[#6F675E] hover:text-[#14110F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[2px_2px_0px_#14110F] hover:-translate-y-0.5 active:translate-y-0 transition-transform disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
