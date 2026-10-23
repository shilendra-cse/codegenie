import { cn } from "@/lib/utils";

export type GlowProps = { soft?: boolean; className?: string };

export function Glow({ soft = false, className }: GlowProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "glow pointer-events-none absolute left-1/2 -z-10 w-[min(1100px,100%)] -translate-x-1/2",
        soft && "glow-soft",
        className,
      )}
    />
  );
}
