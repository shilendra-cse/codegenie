import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Spinner } from "@/components/atoms/spinner";

export type SetupOutcomeProps = {
  projectName: string;
  onStart: () => void;
  starting: boolean;
  /** Why starting failed, when it did. */
  startError: string | null;
} & (
  | { state: "not-started" | "queued" | "stopped" }
  | { state: "failed"; reason: string }
);

/** What sits below the conversation when setup isn't running or saved. */
export function SetupOutcome(props: SetupOutcomeProps) {
  const startError = props.startError && (
    <Alert tone="error">{props.startError}</Alert>
  );

  switch (props.state) {
    case "not-started":
      return (
        <div className="rise flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
          <span className="font-semibold">
            Set up {props.projectName}&apos;s environment
          </span>
          <span className="text-muted-foreground">
            CodeGenie works in a fresh sandbox: it detects how{" "}
            {props.projectName} installs, runs its lint, type-check and tests,
            and fixes what it can. The result is saved and every task starts
            from it.
          </span>
          {startError}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              glow
              busy={props.starting}
              onClick={props.onStart}
            >
              Start setup
            </Button>
            <span className="text-[13px] text-faint">
              A few minutes. You can leave this page.
            </span>
          </div>
        </div>
      );
    case "queued":
      return (
        <div className="rise flex items-center gap-2.5 rounded-lg border border-border bg-card px-[18px] py-3.5 text-muted-foreground">
          <Spinner className="text-faint" />
          Setup starts in a moment.
        </div>
      );
    case "failed":
      return (
        <div
          role="alert"
          className="rise flex flex-col gap-3 rounded-lg border border-err-border bg-err-soft px-[18px] py-4"
        >
          <span className="font-semibold text-err">
            Setup didn&apos;t finish
          </span>
          <span>{props.reason}</span>
          {startError}
          <div>
            <Button busy={props.starting} onClick={props.onStart}>
              Try again
            </Button>
          </div>
        </div>
      );
    case "stopped":
      return (
        <div className="rise flex flex-col gap-3 rounded-lg border border-border bg-card px-[18px] py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-[1_1_240px]">
              You stopped setup. Nothing was saved.
            </span>
            <Button busy={props.starting} onClick={props.onStart}>
              Start again
            </Button>
          </div>
          {startError}
        </div>
      );
  }
}
