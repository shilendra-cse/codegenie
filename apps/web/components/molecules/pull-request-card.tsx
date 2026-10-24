import { ExternalLink, GitPullRequest } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { cn } from "@/lib/utils";

const tones = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  merged: "bg-merged-soft text-merged",
  err: "bg-err-soft text-err",
} as const;

export type PullRequestCardProps = {
  number: number;
  url: string;
  title: string;
  /** Where it stands: "Ready for review · … · into main". */
  line: string;
  tone: keyof typeof tones;
};

export function PullRequestCard({
  number,
  url,
  title,
  line,
  tone,
}: PullRequestCardProps) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-t border-border bg-surface px-4 py-4">
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          tones[tone],
        )}
      >
        <Icon icon={GitPullRequest} size={20} />
      </span>
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-0.5">
        <span className="font-semibold">
          {title} <span className="font-normal text-faint">#{number}</span>
        </span>
        <span className="text-[13px] text-faint">{line}</span>
      </div>
      <Button asChild size="sm">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open PR #${number} on GitHub`}
        >
          Open on GitHub
          <Icon icon={ExternalLink} size={14} />
        </a>
      </Button>
    </div>
  );
}
