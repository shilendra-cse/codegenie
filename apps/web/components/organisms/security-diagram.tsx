import { Bot, GitBranch, Lock, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Badge } from "@/components/atoms/badge";
import { GitHubMark } from "@/components/atoms/github-mark";
import { Icon } from "@/components/atoms/icon";
import { FlowArrow } from "@/components/molecules/flow-arrow";
import { cn } from "@/lib/utils";

function Chip({
  icon,
  mono,
  children,
}: {
  icon: LucideIcon;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[7px] border border-border bg-card px-2.5 text-[12.5px] whitespace-nowrap",
        mono && "font-mono",
      )}
    >
      <Icon icon={icon} size={14} />
      {children}
    </span>
  );
}

const box = "flex flex-col gap-3 rounded-lg bg-card p-[18px]";
const note = "text-[12.5px] text-faint";

export function SecurityDiagram() {
  return (
    <figure
      aria-label="How a change reaches GitHub"
      className="reveal flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface p-7"
    >
      <div
        className={cn(
          box,
          "flex-[1_1_280px] border-[1.5px] border-dashed border-border-strong",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">Sandbox</span>
          <span className="text-xs text-faint">isolated, short-lived</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip icon={Bot}>The agent</Chip>
          <Chip icon={GitBranch} mono>
            your-repo
          </Chip>
        </div>
        <span className={note}>
          Cloned with a read-only token, used once for the clone and never
          stored.
        </span>
      </div>
      <FlowArrow label="changes, checked by hash" />
      <div className={cn(box, "flex-[1_1_220px] border border-border")}>
        <span className="font-semibold">{PRODUCT_NAME}</span>
        <Chip icon={Lock}>Write token · one repo · 1 hour</Chip>
        <span className={note}>Stays outside the sandbox.</span>
      </div>
      <FlowArrow label="verified commit + pull request" />
      <div className={cn(box, "flex-[1_1_180px] gap-2.5 border border-border")}>
        <span className="flex items-center gap-2 font-semibold">
          <GitHubMark size={16} />
          GitHub
        </span>
        <Badge tone="ok" className="self-start">
          Verified
        </Badge>
        <span className={note}>On its own branch. You review and merge.</span>
      </div>
    </figure>
  );
}
