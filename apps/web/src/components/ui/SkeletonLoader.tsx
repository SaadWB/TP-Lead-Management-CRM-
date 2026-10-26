'use client';

import React from 'react';

export function SkeletonLoader({ type = 'table' }: { type?: 'table' | 'dashboard' | 'cards' }) {
  if (type === 'dashboard') {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
        {/* Metric cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-soft-xs space-y-3">
              <div className="h-3 bg-slate-200 rounded w-1/2" />
              <div className="h-7 bg-slate-200 rounded w-1/3" />
            </div>
          ))}
        </div>
        {/* Hero Banner skeleton */}
        <div className="h-32 bg-slate-200 rounded-2xl" />
        {/* Activity feed skeleton */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-soft-xs space-y-4">
          <div className="h-4 bg-slate-200 rounded w-1/4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100">
                <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                <div className="h-3 bg-slate-200 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Default table skeleton
  return (
    <div className="space-y-4 animate-pulse">
      {/* Top Filter & Metric Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-soft-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="h-7 bg-slate-200 rounded-lg w-24" />
          <div className="h-7 bg-slate-200 rounded-lg w-20" />
          <div className="h-7 bg-slate-200 rounded-lg w-28" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-slate-200 rounded-lg w-32" />
          <div className="h-8 bg-slate-200 rounded-lg w-28" />
          <div className="h-8 bg-slate-200 rounded-lg w-8" />
        </div>
      </div>

      {/* Table Container Skeleton */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-soft-xs overflow-hidden">
        {/* Header row */}
        <div className="h-10 bg-slate-100/80 border-b border-slate-200 flex items-center px-4 gap-4">
          <div className="w-8 h-4 bg-slate-200 rounded shrink-0" />
          <div className="w-48 h-4 bg-slate-200 rounded" />
          <div className="w-32 h-4 bg-slate-200 rounded" />
          <div className="w-28 h-4 bg-slate-200 rounded" />
          <div className="w-40 h-4 bg-slate-200 rounded" />
          <div className="w-44 h-4 bg-slate-200 rounded" />
          <div className="flex-1 h-4 bg-slate-200 rounded" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-14 flex items-center px-4 gap-4">
              <div className="w-8 h-4 bg-slate-200 rounded shrink-0" />
              <div className="w-48 space-y-1.5">
                <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                <div className="h-2.5 bg-slate-200 rounded w-1/2" />
              </div>
              <div className="w-32 h-3 bg-slate-200 rounded" />
              <div className="w-28 h-3 bg-slate-200 rounded" />
              <div className="w-40 h-6 bg-slate-200 rounded-lg" />
              <div className="w-44 h-6 bg-slate-200 rounded-lg" />
              <div className="flex-1 h-3 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
