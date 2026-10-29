import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-surface-hover', className)}
    />
  );
}

type ListSkeletonProps = { label: string; rows?: number };

export function ListSkeleton({ label, rows = 4 }: ListSkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="grid gap-2 rounded-lg border border-line bg-surface-raised p-4"
    >
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  );
}
