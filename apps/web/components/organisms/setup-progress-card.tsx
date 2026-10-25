import type { OnboardingState } from "@hobai/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/atoms/alert";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export type SetupProgressCardProps = {
  projectName: string;
  /** Null before the first setup. */
  status: OnboardingState | null;
  href: string;
  /** Short lines about the latest work, newest last. */
  latest: string[];
  elapsedMs: number | null;
  question: string | null;
  failure: string | null;
  onStart: () => void;
  starting: boolean;
  startError: string | null;
};

/** Welcome's step 3: setup started, followed and retried without leaving the checklist. */
export function SetupProgressCard(props: SetupProgressCardProps) {
  const { status } = props;
  const startError = props.startError && (
    <Alert tone="error">{props.startError}</Alert>
  );

  if (status === null || status === "failed" || status === "cancelled") {
    return (
      <div className="flex flex-col gap-3">
        {status === "failed" && (
          <Alert tone="error">
            Setup didn&apos;t finish: {props.failure ?? "something went wrong."}
          </Alert>
        )}
        {status === "cancelled" && (
          <span className="text-[13px] text-muted-foreground">
            You stopped setup. Nothing was saved.
          </span>
        )}
        {startError}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="primary"
            glow
            busy={props.starting}
            onClick={props.onStart}
          >
            {status === null ? "Start setup" : "Try again"}
          </Button>
          <span className="text-[13px] text-faint">You can watch it live.</span>
        </div>
      </div>
    );
  }
  if (status === "succeeded") return null;

  const waiting = status === "waiting";
  return (
    <div className={cn(status === "running" && "beam shadow-none")}>
      <div
        className={cn(
          "flex flex-col gap-2.5 rounded-lg bg-card px-4 py-3.5",
          status !== "running" && "border border-border",
          waiting && "border-primary-border",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {status === "queued" && <Badge>Queued</Badge>}
          {status === "running" && (
            <Badge tone="progress" className="sheen">
              <Spinner size={12} />
              Setting up {props.projectName}
            </Badge>
          )}
          {waiting && <Badge tone="progress">Waiting for your answer</Badge>}
          {props.elapsedMs !== null && (
            <span className="text-xs text-faint">
              {formatDuration(props.elapsedMs)}
            </span>
          )}
          <span className="flex-1" />
          {!waiting && (
            <Button asChild variant="ghost" size="sm">
              <Link href={props.href}>
                Watch it live
                <Icon icon={ArrowRight} size={14} />
              </Link>
            </Button>
          )}
        </div>
        {waiting ? (
          <>
            <span className="font-medium">{props.question}</span>
            <div>
              <Button asChild variant="primary" size="sm" glow>
                <Link href={props.href}>Answer</Link>
              </Button>
            </div>
          </>
        ) : status === "queued" ? (
          <span className="text-[13px] text-muted-foreground">
            Setup starts in a moment.
          </span>
        ) : (
          <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
            {props.latest.map((line, index) => (
              <li key={`${index}:${line}`} className="rise">
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
