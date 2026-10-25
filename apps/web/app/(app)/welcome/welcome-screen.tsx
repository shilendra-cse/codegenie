"use client";

import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { InstallNotice } from "@/components/molecules/install-notice";
import { RepositoryPicker } from "@/components/organisms/repository-picker";
import { SetupProgressCard } from "@/components/organisms/setup-progress-card";
import { TaskComposer } from "@/components/organisms/task-composer";
import { WelcomeChecklist } from "@/components/organisms/welcome-checklist";
import { useAccount } from "@/features/account/use-account";
import { useRepositoryPicker } from "@/features/github/use-repository-picker";
import { useWelcomeChecklist } from "@/features/onboarding/use-welcome-checklist";
import { useProjects } from "@/features/projects/projects";
import { useStartOnboarding } from "@/features/setup/use-onboarding";
import { useSetupProgress } from "@/features/setup/use-setup-progress";
import { useNewTask } from "@/features/tasks/use-new-task";
import { useTasks } from "@/features/tasks/use-tasks";
import { environmentPath, taskPath, WELCOME } from "@/lib/routes";
import { useNow } from "@/lib/use-now";
import { useInstallOutcome } from "../use-install-outcome";

export type WelcomeScreenProps = { github?: string };

export function WelcomeScreen({ github }: WelcomeScreenProps) {
  const { account } = useAccount();
  const checklist = useWelcomeChecklist();
  const addingRepository =
    checklist.status === "ready" &&
    checklist.steps.some((s) => s.id === "add-repo" && s.state === "current");
  const picker = useRepositoryPicker({ enabled: addingRepository });
  const settingUp =
    checklist.status === "ready"
      ? checklist.steps.find((s) => s.id === "set-up" && s.state === "current")
      : undefined;
  const setupProjectId = settingUp?.projectId;
  const setup = useSetupProgress(setupProjectId);
  const startSetup = useStartOnboarding(setupProjectId ?? "");
  const now = useNow(setup.active);
  const startedAt = setup.onboarding?.startedAt;
  const firstTaskStep =
    checklist.status === "ready"
      ? checklist.steps.find((s) => s.id === "first-task")
      : undefined;
  const projects = useProjects();
  const composer = useNewTask({
    projects: projects.data ?? [],
    preferredProjectId: firstTaskStep?.projectId,
  });
  // Newest first: once step 4 is done, this is the task it started.
  const firstTask = useTasks().data?.[0];
  const firstTaskRunning =
    firstTaskStep?.state === "done" &&
    (firstTask?.label === "queued" || firstTask?.label === "working");
  const outcome = useInstallOutcome(github, WELCOME);
  const firstName = account?.name.trim().split(/\s+/)[0];
  const checklistView =
    checklist.status === "ready"
      ? {
          status: checklist.status,
          steps: checklist.steps,
          panels: {
            "add-repo": <RepositoryPicker {...picker} />,
            ...(setupProjectId && {
              "set-up": (
                <SetupProgressCard
                  projectName={settingUp?.projectName ?? "your project"}
                  status={setup.onboarding?.status ?? null}
                  href={environmentPath(setupProjectId)}
                  latest={setup.timeline.latest}
                  elapsedMs={startedAt ? now - Date.parse(startedAt) : null}
                  question={setup.timeline.openQuestion?.question ?? null}
                  failure={setup.onboarding?.error?.message ?? null}
                  onStart={() => startSetup.mutate()}
                  starting={startSetup.isPending}
                  startError={startSetup.error?.message ?? null}
                />
              ),
            }),
            "first-task": (
              <div className="flex flex-col gap-2.5">
                <TaskComposer {...composer} />
                <p className="text-[13px] text-faint">
                  Specific works best: &quot;Add pagination to GET /orders, with
                  tests&quot; beats &quot;improve orders&quot;.
                </p>
              </div>
            ),
          },
          doneBodies: firstTask && {
            "first-task": (
              <>
                &ldquo;{firstTask.title}&rdquo;{" "}
                {firstTaskRunning ? "is running. " : "was your first task. "}
                <Link
                  href={taskPath(firstTask.id)}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {firstTaskRunning ? "Watch it work" : "Open it"}
                </Link>
              </>
            ),
          },
        }
      : checklist.status === "error"
        ? { status: checklist.status, onRetry: checklist.retry }
        : { status: checklist.status };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-7 px-6 py-[72px]">
      <div className="rise flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
          {firstTaskRunning
            ? "Your first task is running."
            : firstName
              ? `Welcome, ${firstName}`
              : "Welcome"}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {firstTaskRunning
            ? "You'll get a pull request to review."
            : "A few steps and CodeGenie is ready to work on your code."}
        </p>
        {firstTaskRunning && firstTask && (
          <Button asChild variant="primary" glow className="mt-2 self-start">
            <Link href={taskPath(firstTask.id)}>Watch it work</Link>
          </Button>
        )}
      </div>
      <InstallNotice outcome={outcome} />
      <WelcomeChecklist {...checklistView} />
      <p className="text-[13px] text-faint">
        CodeGenie works best on JavaScript and TypeScript repositories whose
        install, lint, type-check and tests run without outside services.
      </p>
    </div>
  );
}
