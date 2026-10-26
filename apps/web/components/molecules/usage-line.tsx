import type { UsageResponse } from "@hobai/shared";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

// From 80% used the count turns amber, at the limit red.
const NEAR = 0.8;

export type UsageTone = "ok" | "warn" | "err";

/** How close the cycle is to its limit; null on a plan without one. */
export function usageTone({ runs }: UsageResponse): UsageTone | null {
  if (runs.limit === null) return null;
  if (runs.used >= runs.limit) return "err";
  return runs.used >= runs.limit * NEAR ? "warn" : "ok";
}

const TEXT: Record<UsageTone, string> = {
  ok: "text-muted-foreground",
  warn: "text-warn",
  err: "text-err",
};
const BAR: Record<UsageTone, string> = {
  ok: "bg-muted-foreground",
  warn: "bg-warn",
  err: "bg-err",
};

export function UsageBar({
  usage,
  className,
}: {
  usage: UsageResponse;
  className?: string;
}) {
  const tone = usageTone(usage);
  if (!tone || usage.runs.limit === null) return null;
  const share = Math.min(1, usage.runs.used / usage.runs.limit);
  return (
    <span
      aria-hidden
      className={cn(
        "block h-1 w-full overflow-hidden rounded-full bg-border",
        className,
      )}
    >
      <span
        className={cn("block h-full rounded-full", BAR[tone])}
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}

export const usageToneText = (tone: UsageTone) => TEXT[tone];

export type UsageLineProps = { usage: UsageResponse; onOpen: () => void };

/** The sidebar's "4 of 10 runs · resets 25 Nov"; opens Usage & limits. */
export function UsageLine({ usage, onOpen }: UsageLineProps) {
  const tone = usageTone(usage);
  const { used, limit } = usage.runs;
  const resets = formatDay(usage.resetsAt);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={
        limit === null
          ? "Unlimited runs. Usage and limits"
          : `${used} of ${limit} runs used, resets ${resets}. Usage and limits`
      }
      className="flex w-full flex-col gap-1.5 rounded-sm px-2.5 py-2 text-left text-[12.5px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      <span className="flex w-full items-baseline justify-between gap-2">
        <span className={cn("font-medium", tone && TEXT[tone])}>
          {limit === null ? "Unlimited" : `${used} of ${limit} runs`}
        </span>
        {limit !== null && <span className="text-faint">resets {resets}</span>}
      </span>
      <UsageBar usage={usage} />
    </button>
  );
}
