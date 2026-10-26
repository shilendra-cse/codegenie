import { Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { formatDay } from "@/lib/format";
import { PRICING } from "@/lib/routes";

export type RunLimit = { limit: number; resetsAt: string };

/** Above the composer once the cycle's runs are used. */
export function RunLimitBanner({ limit, resetsAt }: RunLimit) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3.5 py-3"
    >
      <Icon icon={Clock} className="text-faint" />
      <span className="flex-[1_1_320px]">
        You&apos;ve used all {limit} runs this cycle. They reset on{" "}
        <strong className="font-semibold">{formatDay(resetsAt)}</strong>.
      </span>
      <Button asChild size="sm">
        <Link href={PRICING}>See plans</Link>
      </Button>
    </div>
  );
}
