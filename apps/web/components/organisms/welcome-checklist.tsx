import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { ChecklistStep } from "@/components/molecules/checklist-step";
import { cn } from "@/lib/utils";

type StepId = "install" | "add-repo" | "set-up" | "first-task";

export type WelcomeStep = {
  id: StepId;
  state: "done" | "current" | "todo";
  href: string;
  external: boolean;
};

export type WelcomeChecklistProps =
  | { status: "pending" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; steps: WelcomeStep[] };

const COPY: Record<
  StepId,
  { title: string; body: string; label: string; hint?: string }
> = {
  install: {
    title: "Install the GitHub App",
    body: "Choose which repositories CodeGenie can see. You can change the selection on GitHub at any time.",
    label: "Install on GitHub",
    hint: "Opens GitHub, then brings you back here.",
  },
  "add-repo": {
    title: "Add a repository",
    body: "Pick one of the repositories you gave access to. It becomes a project.",
    label: "Choose a repository",
  },
  "set-up": {
    title: "Set up its environment",
    body: "CodeGenie finds out how to install and check it, and asks you if it can’t decide. Once per repository, a few minutes.",
    label: "Start setup",
    hint: "You can watch it live.",
  },
  "first-task": {
    title: "Describe your first task",
    body: "Say what should change. You get a pull request to review.",
    label: "New task",
  },
};

const DELAYS = [
  "",
  "[animation-delay:80ms]",
  "[animation-delay:160ms]",
  "[animation-delay:240ms]",
];

export function WelcomeChecklist(props: WelcomeChecklistProps) {
  if (props.status === "error") {
    return (
      <Alert tone="error" className="flex flex-wrap items-center gap-3">
        <span className="flex-1">We couldn&apos;t load your setup.</span>
        <Button size="sm" onClick={props.onRetry}>
          Try again
        </Button>
      </Alert>
    );
  }
  if (props.status === "pending") {
    return (
      <div
        aria-busy
        aria-label="Loading your setup"
        className="flex flex-col rounded-lg border border-border bg-card"
      >
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex gap-4 border-b border-border p-5 last:border-b-0"
          >
            <Skeleton className="size-7 rounded-full" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3.5 w-full max-w-[420px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ol className="rounded-lg border border-border bg-card">
      {props.steps.map((step, index) => {
        const copy = COPY[step.id];
        return (
          <ChecklistStep
            key={step.id}
            className={cn("rise", DELAYS[index])}
            number={index + 1}
            state={step.state}
            title={copy.title}
            body={copy.body}
            hint={copy.hint}
            action={{
              label: copy.label,
              href: step.href,
              external: step.external,
            }}
          />
        );
      })}
    </ol>
  );
}
