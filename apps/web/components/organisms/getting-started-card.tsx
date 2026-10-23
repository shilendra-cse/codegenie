import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/atoms/icon";
import { APP_HOME } from "@/lib/routes";

type StepId = "install" | "add-repo" | "set-up" | "first-task";

const NEXT: Record<StepId, (projectName?: string) => string> = {
  install: () => "Install the GitHub App",
  "add-repo": () => "Add a repository",
  "set-up": (name) => (name ? `Set up ${name}` : "Set up its environment"),
  "first-task": () => "Describe your first task",
};

const TOTAL = 4;

export type GettingStartedCardProps = {
  done: number;
  next: StepId;
  projectName?: string;
};

export function GettingStartedCard({
  done,
  next,
  projectName,
}: GettingStartedCardProps) {
  return (
    <Link
      href={APP_HOME}
      className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
    >
      <span className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">Getting started</span>
        <span className="text-xs text-faint">
          {done} of {TOTAL}
        </span>
      </span>
      <span aria-hidden className="h-1 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${(done / TOTAL) * 100}%` }}
        />
      </span>
      <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
        Next: {NEXT[next](projectName)}
        <Icon icon={ArrowRight} size={14} />
      </span>
    </Link>
  );
}
