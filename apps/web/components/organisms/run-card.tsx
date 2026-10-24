import { ExternalLink } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Logo } from "@/components/atoms/logo";
import { RunStage, type RunStageState } from "@/components/molecules/run-stage";
import {
  type ActivityView,
  RunActivity,
} from "@/components/organisms/run-activity";
import { cn } from "@/lib/utils";

export type RunStageView = {
  id: string;
  name: string;
  state: RunStageState;
  summary: string | null;
  durationMs: number | null;
};

export type RunCardProps = {
  number: number;
  /** Queued or running: the card gets the beam. */
  live: boolean;
  /** "step 14 · $0.08" */
  meta: string | null;
  stages: RunStageView[];
  activity: ActivityView[];
  reasoning: string;
  /** How the run ended, until step 7's outcome card. */
  outcome: {
    text: string;
    failed: boolean;
    pullRequest: { number: number; url: string } | null;
  } | null;
};

export function RunCard(props: RunCardProps) {
  return (
    <div className={cn("rise", props.live && "beam shadow-none")}>
      <article
        aria-label={`Run ${props.number}`}
        className={cn(
          "overflow-hidden rounded-lg bg-card",
          !props.live && "border border-border",
        )}
      >
        <header className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
          <span className="flex size-7 items-center justify-center rounded-md border border-border bg-card">
            <Logo variant="mark" />
          </span>
          <span className="font-semibold">CodeGenie</span>
          <span className="text-[13px] text-faint">Run {props.number}</span>
          {props.meta && (
            <span className="ml-auto text-[13px] text-faint">{props.meta}</span>
          )}
        </header>
        {props.stages.map((stage) => (
          <RunStage
            key={stage.id}
            name={stage.name}
            state={stage.state}
            summary={stage.summary}
            durationMs={stage.durationMs}
          >
            {stage.id === "working" && (
              <RunActivity
                activity={props.activity}
                reasoning={props.reasoning}
                live={stage.state === "running"}
              />
            )}
          </RunStage>
        ))}
        {props.outcome && (
          <footer className="flex flex-col gap-3 border-t border-border bg-surface px-4 py-3.5">
            <p
              className={cn(
                "whitespace-pre-wrap",
                props.outcome.failed ? "text-err" : "text-muted-foreground",
              )}
            >
              {props.outcome.text}
            </p>
            {props.outcome.pullRequest && (
              <Button asChild size="sm" className="self-start">
                <a
                  href={props.outcome.pullRequest.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open PR #{props.outcome.pullRequest.number} on GitHub
                  <Icon icon={ExternalLink} size={14} />
                </a>
              </Button>
            )}
          </footer>
        )}
      </article>
    </div>
  );
}
