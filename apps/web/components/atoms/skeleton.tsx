import { cn } from "@/lib/utils";

export type SkeletonProps = { className?: string };

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-sm bg-muted motion-reduce:animate-none",
        className,
      )}
    />
  );
}
