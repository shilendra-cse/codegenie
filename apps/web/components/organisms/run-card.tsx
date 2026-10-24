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
  /** Opens an activity row (an edit, a command, a check run) in the side panel. */
  onSelectActivity?: (row: ActivityView) => void;
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
                onSelect={props.onSelectActivity}
              />
            )}
          </RunStage>
        ))}
      </article>
    </div>
  );
}
