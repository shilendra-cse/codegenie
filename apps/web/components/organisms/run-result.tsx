import Link from "next/link";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Logo } from "@/components/atoms/logo";
import {
  ChecksTable,
  type CheckRowView,
} from "@/components/molecules/checks-table";
import {
  PullRequestCard,
  type PullRequestCardProps,
} from "@/components/molecules/pull-request-card";

const ALERT_TONES = { warn: "warn", err: "error", neutral: "info" } as const;

export type RunResultProps = {
  /** Which run this answers, for its label. */
  number: number;
  /** "2 minutes ago" */
  time: string;
  notice: {
    tone: keyof typeof ALERT_TONES;
    title: string;
    text: string | null;
    note: string | null;
    action: { label: string; href: string } | null;
  } | null;
  summary: string | null;
  noBranch: boolean;
  checks: CheckRowView[] | null;
  /** For runs that only recorded whether all checks passed. */
  checksLine: string | null;
  pullRequest: PullRequestCardProps | null;
};

/** CodeGenie's reply once a run has ended: how it went, and the pull request. */
export function RunResult(props: RunResultProps) {
  const { notice } = props;
  return (
    <article
      aria-label={`Result of run ${props.number}`}
      className="rise overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex items-center gap-2.5 px-4 pt-3">
        <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
          <Logo variant="mark" />
        </span>
        <span className="font-semibold">CodeGenie</span>
        <span className="text-xs text-faint">{props.time}</span>
      </header>
      <div className="flex flex-col gap-2.5 p-4">
        {notice && (
          <Alert
            tone={ALERT_TONES[notice.tone]}
            className="flex flex-col gap-1"
          >
            <span className="font-semibold">{notice.title}</span>
            {notice.text && (
              <span className="whitespace-pre-wrap text-foreground">
                {notice.text}
              </span>
            )}
            {notice.note && (
              <span className="text-muted-foreground">{notice.note}</span>
            )}
          </Alert>
        )}
        {notice?.action && (
          <Button asChild size="sm" className="self-start">
            <Link href={notice.action.href}>{notice.action.label}</Link>
          </Button>
        )}
        {props.summary && (
          <p className="whitespace-pre-wrap">{props.summary}</p>
        )}
        {props.noBranch && (
          <p className="text-[13px] text-muted-foreground">
            No branch or pull request was created.
          </p>
        )}
        {props.checks && (
          <ChecksTable checks={props.checks} afterFallback="—" />
        )}
        {props.checksLine && (
          <p className="text-[13px] text-muted-foreground">
            {props.checksLine}
          </p>
        )}
      </div>
      {props.pullRequest && <PullRequestCard {...props.pullRequest} />}
    </article>
  );
}
