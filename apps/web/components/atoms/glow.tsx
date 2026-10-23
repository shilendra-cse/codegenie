import { cn } from "@/lib/utils";

export type GlowProps = { className?: string };

export function Glow({ className }: GlowProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "glow pointer-events-none absolute left-1/2 -z-10 w-[min(1100px,100%)] -translate-x-1/2",
        className,
      )}
    />
  );
}
