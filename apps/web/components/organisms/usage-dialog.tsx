import type { UsageResponse } from "@hobai/shared";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/atoms/dialog";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import {
  UsageBar,
  usageTone,
  usageToneText,
} from "@/components/molecules/usage-line";
import { formatDay } from "@/lib/format";
import { PRICING } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type UsageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usage: UsageResponse | undefined;
  failed: boolean;
};

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-[13.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Usage({ usage }: { usage: UsageResponse }) {
  const tone = usageTone(usage);
  const { used, limit } = usage.runs;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="font-semibold text-foreground">
          {usage.plan.name}
        </Badge>
        <span className="text-[13px] text-faint">
          Cycle {formatDay(usage.periodStart)} – {formatDay(usage.resetsAt)}
        </span>
      </div>
      {limit === null ? (
        <p>
          <span className="text-2xl font-semibold tracking-[-0.02em]">
            {used}
          </span>
          <span className="text-muted-foreground">
            {" "}
            {used === 1 ? "run" : "runs"} this cycle · no run limit
          </span>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p>
              <span
                className={cn(
                  "text-2xl font-semibold tracking-[-0.02em]",
                  tone && usageToneText(tone),
                )}
              >
                {used}
              </span>
              <span className="text-muted-foreground">
                {" "}
                of {limit} runs used
              </span>
            </p>
            <span className="text-[13px] text-faint">
              resets {formatDay(usage.resetsAt)}
            </span>
          </div>
          <UsageBar usage={usage} className="h-1.5" />
        </div>
      )}
      <div className="pt-1">
        <Limit
          label="Runs per cycle"
          value={limit === null ? "No limit" : String(limit)}
        />
        <Limit label="Tasks at once" value={String(usage.concurrentRuns)} />
        <Limit label="Setting up a repository" value="Doesn't count" />
      </div>
      <p className="text-xs text-faint">
        Runs that failed on {PRODUCT_NAME}&apos;s side don&apos;t count.
      </p>
    </>
  );
}

export function UsageDialog({
  open,
  onOpenChange,
  usage,
  failed,
}: UsageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3.5 sm:max-w-[480px]">
        <DialogTitle>Usage &amp; limits</DialogTitle>
        {usage ? (
          <Usage usage={usage} />
        ) : failed ? (
          <p role="alert" className="text-[13px] text-err">
            Couldn&apos;t load your usage.
          </p>
        ) : (
          <Skeleton className="h-40" />
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button asChild variant="ghost" size="sm" className="pl-0">
            <Link href={PRICING}>
              See plans
              <Icon icon={ArrowRight} size={14} />
            </Link>
          </Button>
          <DialogClose asChild>
            <Button size="sm">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
