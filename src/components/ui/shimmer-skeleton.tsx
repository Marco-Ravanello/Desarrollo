import React from "react";
import { Card } from "@/components/ui/card";

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full rounded-3xl border border-border/60 overflow-hidden bg-card animate-pulse">
      <div className="bg-muted/50 p-4 border-b border-border/60 flex items-center justify-between gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-muted-foreground/15 rounded-md w-24" />
        ))}
      </div>
      <div className="divide-y divide-border/40 p-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex items-center justify-between gap-4">
            <div className="h-4 bg-muted-foreground/20 rounded-md w-36" />
            <div className="h-4 bg-muted-foreground/15 rounded-md w-28" />
            <div className="h-6 bg-muted-foreground/15 rounded-xl w-20" />
            <div className="h-8 bg-muted-foreground/20 rounded-xl w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-6 rounded-3xl border border-border/60 bg-card/80 animate-pulse space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-3 bg-muted-foreground/20 rounded-md w-24" />
            <div className="w-8 h-8 bg-muted-foreground/15 rounded-xl" />
          </div>
          <div className="h-8 bg-muted-foreground/25 rounded-md w-28" />
          <div className="h-2.5 bg-muted-foreground/15 rounded-md w-40" />
        </Card>
      ))}
    </div>
  );
}
