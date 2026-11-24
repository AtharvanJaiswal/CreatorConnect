'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../providers/auth-provider';
import { communityFrontendService } from '../../../../services/community.service';
import { ArrowLeft, Calendar, Clock, MapPin, Users, Share2, Bookmark } from 'lucide-react';

const AGENDA_ITEMS = [
  { time: '4:00 PM – 4:45 PM', title: 'Registration & Local Crew Meet & Greet' },
  { time: '5:00 PM – 6:15 PM', title: 'Hands-on Ronin 4D vs Alexa 35 Monsoon Shootout' },
  {
    time: '6:30 PM – 7:15 PM',
    title: 'Panel: Platform Escrow & Milestone Protection for Freelancers',
  },
  { time: '7:30 PM – 8:30 PM', title: 'Open Mixer, Gear Testing Tables & Project Matchmaking' },
];

const ATTENDEES = [
  { name: 'Kavya Nair', role: 'Studio Atelier', avatar: 'KN', bg: 'bg-[#FFD64A]' },
  { name: 'Aarav Mehta', role: 'Cinematographer', avatar: 'AM', bg: 'bg-[#C9B6F7]' },
  { name: 'Priya Sharma', role: 'Colorist', avatar: 'PS', bg: 'bg-[#B6E09B]' },
  { name: 'Rohan Deshmukh', role: 'Camera Op', avatar: 'RD', bg: 'bg-[#FFB6C8]' },
  { name: 'Ananya V.', role: 'Brand Director', avatar: 'AV', bg: 'bg-[#A6CCF7]' },
];

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;

  const { accessToken } = useAuth();
  const [isRsvpd, setIsRsvpd] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(48);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch live event details
  useEffect(() => {
    let isMounted = true;
    if (!eventId) return;

    const fetchLiveEvent = async () => {
      try {
        const eventRes = await communityFrontendService.getEventById(eventId, accessToken);
        if (isMounted && eventRes) {
          setIsRsvpd(eventRes.isRsvpd);
          setRsvpCount(eventRes.rsvpCount);
        }
      } catch {
        // Fallback to static fixtures gracefully
      }
    };

    fetchLiveEvent();
    return () => {
      isMounted = false;
    };
  }, [eventId, accessToken]);

  const toggleRsvp = async () => {
    if (isUpdating) return;
    const nextStatus = !isRsvpd ? 'CONFIRMED' : 'CANCELLED';

    // Optimistic update
    setIsRsvpd(!isRsvpd);
    setRsvpCount((prev) => (!isRsvpd ? prev + 1 : Math.max(0, prev - 1)));

    if (accessToken && eventId) {
      setIsUpdating(true);
      try {
        const res = await communityFrontendService.rsvpEvent(eventId, nextStatus, accessToken);
        setIsRsvpd(res.status === 'CONFIRMED');
        setRsvpCount(res.rsvpCount);
      } catch {
        // Rollback optimistic state
        setIsRsvpd(isRsvpd);
        setRsvpCount((prev) => (isRsvpd ? prev + 1 : Math.max(0, prev - 1)));
      } finally {
        setIsUpdating(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] text-[#14110F] flex flex-col font-sans selection:bg-[#FFD64A] selection:text-[#14110F]">
      <div className="max-w-4xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6F675E] hover:text-[#14110F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Community Events</span>
          </Link>
          <span className="text-xs text-[#6F675E]">Event ID: {eventId || 'evt-1'}</span>
        </div>

        {/* Hero Banner Card */}
        <div className="rounded-3xl bg-white border border-[#E7E0D5] p-6 sm:p-10 shadow-sm flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B6E09B] text-xs font-bold uppercase tracking-wider text-[#14110F] self-start">
                <Calendar className="w-3.5 h-3.5" /> Official Community Meetup
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#14110F] leading-tight">
                Mumbai Creators Monsoon Mixer: Live Gear Testing &amp; Podcasting Panel
              </h1>
              <p className="text-sm text-[#4D4634]">
                Organized by <strong className="text-[#14110F]">Studio Atelier</strong> and the
                Mumbai Creative Collective.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start">
              <button
                className="p-2.5 rounded-full hover:bg-[#FAF2EE] text-[#6F675E] hover:text-[#14110F] transition-colors"
                aria-label="Bookmark event"
              >
                <Bookmark className="w-5 h-5" />
              </button>
              <button
                className="p-2.5 rounded-full hover:bg-[#FAF2EE] text-[#6F675E] hover:text-[#14110F] transition-colors"
                aria-label="Share event"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Event Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-[#FAF2EE] border border-[#E7E0D5]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD64A] flex items-center justify-center text-[#14110F] shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#6F675E]">Date</span>
                <span className="font-bold text-xs text-[#14110F]">Saturday, June 14, 2026</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C9B6F7] flex items-center justify-center text-[#14110F] shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#6F675E]">Timing</span>
                <span className="font-bold text-xs text-[#14110F]">4:00 PM – 8:30 PM IST</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFB6C8] flex items-center justify-center text-[#14110F] shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#6F675E]">Location</span>
                <span className="font-bold text-xs text-[#14110F]">
                  Bandra Base, 29th Road, Bandra West
                </span>
              </div>
            </div>
          </div>

          {/* RSVP Callout & Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#FAF6EF] border border-[#E7E0D5]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#14110F] text-[#FFD64A] flex items-center justify-center font-black text-lg shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#14110F]">
                  {rsvpCount} Local Creators Confirmed
                </span>
                <span className="text-xs text-[#6F675E]">
                  Studio capacity strictly limited to 60 seats. Free verified admission.
                </span>
              </div>
            </div>

            <button
              onClick={toggleRsvp}
              className={`h-11 px-8 rounded-full font-bold text-xs uppercase tracking-wider border-2 border-[#14110F] transition-all cursor-pointer ${
                isRsvpd
                  ? 'bg-[#2E9E6B] text-white shadow-xs'
                  : 'bg-[#FFD64A] text-[#14110F] shadow-[2px_2px_0px_#14110F] hover:-translate-y-0.5 active:translate-y-0'
              }`}
            >
              {isRsvpd ? '✓ RSVP Confirmed (Attending)' : 'Reserve Free Ticket'}
            </button>
          </div>

          {/* Detailed Agenda */}
          <div className="flex flex-col gap-4">
            <h3 className="font-bold text-base text-[#14110F]">Event Schedule &amp; Workshops</h3>
            <div className="flex flex-col gap-3">
              {AGENDA_ITEMS.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-[#FAF2EE] flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-bold text-[#725C00]">{item.time}</span>
                  <span className="font-semibold text-[#14110F]">{item.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attendees Preview */}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#FAF2EE]">
            <h3 className="font-bold text-sm uppercase tracking-wider text-[#6F675E]">
              Attending Creators
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {ATTENDEES.map((att) => (
                <div
                  key={att.name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF2EE] border border-[#E7E0D5]"
                >
                  <div
                    className={`w-6 h-6 rounded-full ${att.bg} flex items-center justify-center font-bold text-[10px] text-[#14110F]`}
                  >
                    {att.avatar}
                  </div>
                  <span className="text-xs font-bold text-[#14110F]">{att.name}</span>
                </div>
              ))}
              <span className="text-xs text-[#6F675E] pl-2">
                +{rsvpCount - ATTENDEES.length} more
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
