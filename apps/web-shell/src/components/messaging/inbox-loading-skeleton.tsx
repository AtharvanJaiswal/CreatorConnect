import React from 'react';

export function InboxLoadingSkeleton() {
  return (
    <div
      className="flex flex-col gap-3 w-full animate-pulse"
      aria-busy="true"
      aria-label="Loading conversations"
    >
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="p-4 rounded-2xl bg-white border border-[#E7E0D5] flex items-start gap-3.5"
        >
          {/* Avatar Skeleton */}
          <div className="w-12 h-12 rounded-2xl bg-[#EFE9DF] shrink-0" />

          {/* Text Skeletons */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-[#EFE9DF] rounded-md" />
              <div className="h-3 w-12 bg-[#EFE9DF] rounded-md" />
            </div>
            <div className="h-3 w-48 bg-[#EFE9DF] rounded-md" />
            <div className="h-3 w-full bg-[#EFE9DF] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
