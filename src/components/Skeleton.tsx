import React from "react";
import { cn } from "../lib/utils";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/10", className)}
      {...props}
    />
  );
}

// Pre-built skeletons for common patterns
export function CardSkeleton() {
  return (
    <div className="border border-white/10 bg-black/20 rounded-xl p-6 flex flex-col gap-4">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="pt-4 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="mt-auto pt-4 flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-white/10 bg-black/20 rounded-lg p-4 flex gap-4 items-center">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-grow">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number, cols?: number }) {
  return (
    <div className="w-full border border-white/10 bg-black/20 rounded-lg overflow-hidden">
      <div className="border-b border-white/10 p-4 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`head-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="p-4 flex gap-4 border-b border-white/5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`cell-${r}-${c}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
