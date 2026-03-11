import React from 'react';

/** Base skeleton block with shimmer animation */
const Base: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-shimmer rounded-xl ${className}`} />
);

/** Avatar placeholder (circle) */
export const SkeletonAvatar: React.FC<{ size?: string }> = ({ size = 'w-10 h-10' }) => (
  <div className={`skeleton-shimmer rounded-full shrink-0 ${size}`} />
);

/** Single text line */
export const SkeletonText: React.FC<{ width?: string; height?: string }> = ({
  width = 'w-24',
  height = 'h-3',
}) => (
  <div className={`skeleton-shimmer rounded-md ${width} ${height}`} />
);

/** Card placeholder — mimics a typical list card */
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
    <div className="flex items-center gap-3">
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-32" height="h-3.5" />
        <SkeletonText width="w-20" height="h-2.5" />
      </div>
    </div>
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonText key={i} width={i === 0 ? 'w-full' : 'w-3/4'} height="h-3" />
    ))}
  </div>
);

/** Row placeholder — mimics a leaderboard or list row */
export const SkeletonRow: React.FC = () => (
  <div className="flex items-center gap-3 p-3">
    <SkeletonAvatar size="w-8 h-8" />
    <div className="flex-1 space-y-1.5">
      <SkeletonText width="w-28" height="h-3" />
      <SkeletonText width="w-16" height="h-2.5" />
    </div>
    <SkeletonText width="w-10" height="h-6" />
  </div>
);

/** Event card skeleton */
export const SkeletonEvent: React.FC = () => (
  <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-start gap-4">
    <Base className="w-14 h-14 rounded-xl shrink-0" />
    <div className="flex-1 space-y-2">
      <SkeletonText width="w-36" height="h-4" />
      <SkeletonText width="w-24" height="h-3" />
      <SkeletonText width="w-44" height="h-2.5" />
    </div>
  </div>
);

/** Widget skeleton for HomeScreen */
export const SkeletonWidget: React.FC = () => (
  <div className="bg-white dark:bg-[#1e2330] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
    <div className="flex items-center gap-3">
      <Base className="w-10 h-10 rounded-xl shrink-0" />
      <SkeletonText width="w-28" height="h-4" />
    </div>
    <SkeletonText width="w-full" height="h-3" />
    <SkeletonText width="w-2/3" height="h-3" />
  </div>
);
