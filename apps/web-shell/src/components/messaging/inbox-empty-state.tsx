import React from 'react';
import Link from 'next/link';
import { MessageSquare, ArrowRight } from 'lucide-react';

export function InboxEmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white rounded-3xl border border-[#E7E0D5] shadow-xs w-full"
      role="status"
    >
      <div className="w-16 h-16 rounded-full bg-[#FAF6EF] border border-[#E7E0D5] flex items-center justify-center mb-4 text-[#6F675E] shadow-2xs">
        <MessageSquare className="w-8 h-8 text-[#8C827A]" />
      </div>

      <h3 className="font-serif text-2xl font-bold text-[#14110F] mb-2 tracking-tight">
        No Active Conversations Yet
      </h3>

      <p className="text-sm text-[#6F675E] max-w-md mb-6 leading-relaxed">
        When you submit proposals, collaborate on assignments, or receive direct inquiries from
        brands, your message threads will appear here in real time.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/discovery">
          <button className="bg-[#FFD64A] hover:bg-[#F5CB35] text-[#14110F] font-bold text-xs px-5 py-2.5 rounded-full shadow-2xs transition-all flex items-center gap-2">
            Browse Discovery <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Link>
        <Link href="/assignments">
          <button className="bg-[#FAF6EF] hover:bg-[#F2ECE1] text-[#14110F] font-bold text-xs px-5 py-2.5 rounded-full border border-[#DDD5C7] transition-all">
            View Assignments
          </button>
        </Link>
      </div>
    </div>
  );
}
