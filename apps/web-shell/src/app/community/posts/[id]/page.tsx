'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../providers/auth-provider';
import { communityFrontendService } from '../../../../services/community.service';
import {
  ArrowLeft,
  Heart,
  Share2,
  Bookmark,
  MessageSquare,
  CheckCircle2,
  Send,
  Shield,
} from 'lucide-react';

interface Comment {
  id: string;
  author: {
    name: string;
    role: string;
    avatar: string;
    bg: string;
  };
  timeAgo: string;
  text: string;
  applauds: number;
}

const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'c-1',
    author: {
      name: 'Rhea Sen',
      role: 'First AC / Focus Puller',
      avatar: 'RS',
      bg: 'bg-[#B6E09B]',
    },
    timeAgo: '1 hour ago',
    text: 'I worked with the Ronin 4D 8K on a 5-day web series in Bandra last month. Highly recommend using the high-gain transmission antennas if you are shooting near wet terrain or rain setups.',
    applauds: 12,
  },
  {
    id: 'c-2',
    author: {
      name: 'Tariq Khan',
      role: 'Line Producer • Mumbai Motion',
      avatar: 'TK',
      bg: 'bg-[#C9B6F7]',
    },
    timeAgo: '45 mins ago',
    text: 'Is platform escrow deposit already funded into the milestone contract? Can confirm my second unit focus puller is available for June 4–6.',
    applauds: 8,
  },
];

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.id as string;

  const { accessToken } = useAuth();
  const [applaudCount, setApplaudCount] = useState(88);
  const [hasApplauded, setHasApplauded] = useState(false);
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Post & Comments Fetch
  useEffect(() => {
    let isMounted = true;
    if (!postId) return;

    const fetchLiveDetails = async () => {
      try {
        const [postRes, commentsRes] = await Promise.allSettled([
          communityFrontendService.getPostById(postId, accessToken),
          communityFrontendService.getComments(postId),
        ]);

        if (isMounted && postRes.status === 'fulfilled') {
          setApplaudCount(postRes.value.applaudsCount);
          setHasApplauded(postRes.value.hasApplauded);
        }

        if (isMounted && commentsRes.status === 'fulfilled' && commentsRes.value.items.length > 0) {
          const mapped: Comment[] = commentsRes.value.items.map((c: any) => ({
            id: c.id,
            author: {
              name: c.author.name,
              role: c.author.role || 'Member',
              avatar: c.author.initials,
              bg: 'bg-[#B6E09B]',
            },
            timeAgo: 'Recently',
            text: c.content,
            applauds: c.applaudsCount,
          }));
          setComments(mapped);
        }
      } catch {
        // Fallback to static fixtures gracefully
      }
    };

    fetchLiveDetails();
    return () => {
      isMounted = false;
    };
  }, [postId, accessToken]);

  const handleApplaud = async () => {
    if (!hasApplauded) {
      setApplaudCount((prev) => prev + 1);
      setHasApplauded(true);
    } else {
      setApplaudCount((prev) => Math.max(0, prev - 1));
      setHasApplauded(false);
    }

    if (accessToken && postId) {
      try {
        await communityFrontendService.applaudPost(postId, accessToken);
      } catch {
        // Ignored
      }
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (accessToken && postId) {
        const created = await communityFrontendService.createComment(
          postId,
          newComment.trim(),
          accessToken,
        );

        const commentObj: Comment = {
          id: created.id,
          author: {
            name: created.author.name,
            role: created.author.role || 'Member',
            avatar: created.author.initials,
            bg: 'bg-[#FFD64A]',
          },
          timeAgo: 'Just now',
          text: created.content,
          applauds: created.applaudsCount,
        };

        setComments((prev) => [...prev, commentObj]);
      } else {
        const commentObj: Comment = {
          id: `c-${Date.now()}`,
          author: {
            name: 'Kavya Nair',
            role: 'Studio Atelier',
            avatar: 'KN',
            bg: 'bg-[#FFD64A]',
          },
          timeAgo: 'Just now',
          text: newComment,
          applauds: 1,
        };
        setComments((prev) => [...prev, commentObj]);
      }
      setNewComment('');
    } catch (err: any) {
      alert(err?.message || 'Failed to submit comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col font-sans selection:bg-[#FFD64A] selection:text-[#14110F]">
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Navigation / Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Mumbai Community Hub</span>
          </Link>
          <span className="text-xs text-[#6F675E]">Dispatch #{postId || 'post-1'}</span>
        </div>

        {/* Main Article Container */}
        <article className="rounded-3xl bg-white border border-[#E7E0D5] p-6 sm:p-10 shadow-sm flex flex-col gap-6">
          {/* Post Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#FAF2EE]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#C9B6F7] flex items-center justify-center font-bold text-base text-[#14110F]">
                AM
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base text-[#14110F]">Aarav Mehta</span>
                  <CheckCircle2 className="w-4 h-4 text-[#725C00]" />
                  <span className="px-2 py-0.5 rounded-full bg-[#FFD64A] text-[10px] font-bold uppercase tracking-wider text-[#14110F]">
                    Community Guide
                  </span>
                </div>
                <span className="text-xs text-[#6F675E]">
                  Film & Broadcast • Bandra West, Mumbai
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="px-3 py-1 rounded-full bg-[#FAF2EE] text-xs font-bold text-[#6F675E]">
                2 days ago
              </span>
              <button
                className="p-2 rounded-full hover:bg-[#FAF2EE] text-[#6F675E] hover:text-[#14110F] transition-colors"
                aria-label="Bookmark dispatch"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                className="p-2 rounded-full hover:bg-[#FAF2EE] text-[#6F675E] hover:text-[#14110F] transition-colors"
                aria-label="Share dispatch"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Headline & Body */}
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl sm:text-3xl font-black text-[#14110F] leading-tight">
              Welcome to the Mumbai Summer Creative Collective: Rules, monthly meetups &amp; local
              gear pooling
            </h1>

            <div className="prose text-[#4D4634] text-sm sm:text-base leading-relaxed flex flex-col gap-3">
              <p>
                Welcome to our shared regional collective. The Mumbai Creators Hub brings together
                over 1,800 active directors, cinematographers, podcasters, colorists, and brand
                studios across Bandra, Andheri, and Lower Parel.
              </p>
              <p>
                To maintain high production standards and professional safety, all members must
                observe the following platform guidelines:
              </p>
              <ul className="list-disc pl-5 flex flex-col gap-1.5">
                <li>
                  <strong className="text-[#14110F]">Paid Opportunities:</strong> Any crew call or
                  assignment broadcast must utilize CreatorConnect Platform Escrow (#PRJ milestone
                  contracts). Uncontracted solicitation or speculative unpaid work is strictly
                  prohibited.
                </li>
                <li>
                  <strong className="text-[#14110F]">Gear Pooling:</strong> All camera packages and
                  wireless transmission gear shared through community threads must include verified
                  transit insurance documentation.
                </li>
                <li>
                  <strong className="text-[#14110F]">Monthly Meetups:</strong> Offline meetups are
                  held every second Saturday. RSVP through the Events tab is required for studio
                  capacity.
                </li>
              </ul>
            </div>
          </div>

          {/* Escrow Link Callout */}
          <div className="p-4 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#725C00]" />
              <span className="text-xs font-bold text-[#14110F]">
                CreatorConnect Trust &amp; Escrow Guarantee applies to all verified dispatches.
              </span>
            </div>
            <Link
              href="/assignments"
              className="text-xs font-bold text-[#725C00] hover:underline whitespace-nowrap"
            >
              Browse Escrow Briefs →
            </Link>
          </div>

          {/* Applaud & Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-[#FAF2EE]">
            <button
              onClick={handleApplaud}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                hasApplauded
                  ? 'bg-[#BA1A1A] text-white shadow-xs'
                  : 'bg-[#FAF2EE] hover:bg-[#F5ECE8] text-[#14110F] border border-[#E7E0D5]'
              }`}
            >
              <Heart className={`w-4 h-4 ${hasApplauded ? 'fill-current' : ''}`} />
              <span>{applaudCount} Applauds</span>
            </button>

            <span className="text-xs font-bold text-[#6F675E]">
              {comments.length} Discussion Responses
            </span>
          </div>
        </article>

        {/* Discussion Responses Section */}
        <section className="rounded-3xl bg-white border border-[#E7E0D5] p-6 sm:p-8 shadow-sm flex flex-col gap-6">
          <h2 className="text-lg font-black text-[#14110F] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#725C00]" />
            <span>Discussion Thread</span>
          </h2>

          {/* New Comment Form */}
          <form onSubmit={handleAddComment} className="flex flex-col gap-3">
            <textarea
              rows={3}
              placeholder="Contribute your insight, gear recommendation, or question..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full p-4 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5] text-sm text-[#14110F] focus:outline-none focus:ring-2 focus:ring-[#FFD64A]"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FFD64A] text-[#14110F] font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] shadow-[2px_2px_0px_#14110F] hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Post Reply</span>
              </button>
            </div>
          </form>

          {/* Comment Stream */}
          <div className="flex flex-col gap-4 divide-y divide-[#FAF2EE]">
            {comments.map((comment) => (
              <div key={comment.id} className="pt-4 first:pt-0 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-full ${comment.author.bg} flex items-center justify-center font-bold text-xs text-[#14110F]`}
                    >
                      {comment.author.avatar}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-[#14110F]">{comment.author.name}</h4>
                      <p className="text-[10px] text-[#6F675E]">{comment.author.role}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#6F675E]">{comment.timeAgo}</span>
                </div>
                <p className="text-xs text-[#4D4634] leading-relaxed pl-10">{comment.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
