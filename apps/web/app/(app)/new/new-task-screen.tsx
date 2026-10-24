"use client";

import { createTaskSchema, type ProjectResponse } from "@codegenie/shared";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import type { PickerProject } from "@/components/molecules/project-picker";
import { RecentTasks } from "@/components/organisms/recent-tasks";
import { TaskComposer } from "@/components/organisms/task-composer";
import { toSidebarProject, useProjects } from "@/features/projects/projects";
import {
  defaultProjectId,
  startTaskError,
  taskReadiness,
} from "@/features/tasks/start-task";
import { useStartTask, useTasks } from "@/features/tasks/use-tasks";
import { ADD_REPOSITORY, taskPath } from "@/lib/routes";

const RECENT = 5;
const LAST_PROJECT = "codegenie:last-project";

// Only a convenience: storage can be unavailable (private windows, blocked site data).
const lastProject = () => {
  try {
    return localStorage.getItem(LAST_PROJECT);
  } catch {
    return null;
  }
};
const rememberProject = (id: string) => {
  try {
    localStorage.setItem(LAST_PROJECT, id);
  } catch {}
};

function toPickerProject(project: ProjectResponse): PickerProject {
  const readiness = taskReadiness(project);
  return {
    ...toSidebarProject(project),
    branch: project.defaultBranch,
    blocked: readiness.ready ? null : readiness,
  };
}

export type NewTaskScreenProps = { projectId?: string };

export function NewTaskScreen({ projectId: requested }: NewTaskScreenProps) {
  const router = useRouter();
  const projects = useProjects();
  const tasks = useTasks();
  const [text, setText] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);

  const all = projects.data ?? [];
  const pickable = all.map(toPickerProject);
  const projectId =
    chosenId ?? defaultProjectId(all, [requested, lastProject()]);
  const project = all.find((p) => p.id === projectId);
  const startTask = useStartTask(projectId ?? "");

  const baseBranch = branch ?? project?.defaultBranch ?? "";
  const branchCheck = createTaskSchema.shape.baseBranch.safeParse(baseBranch);
  const branchError =
    branch !== null && !branchCheck.success
      ? (branchCheck.error.issues[0]?.message ?? "Not a valid branch name.")
      : null;

  const start = () => {
    if (!projectId) return;
    startTask.mutate(
      { prompt: text, baseBranch },
      {
        onSuccess: (created) => {
          rememberProject(projectId);
          router.push(taskPath(created.task.id));
        },
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7 px-6 pt-[14vh] pb-16">
      <h1 className="rise text-center text-[28px] font-semibold tracking-[-0.02em]">
        What should CodeGenie do?
      </h1>

      {projects.isError ? (
        <Alert tone="error">
          Couldn&apos;t load your projects.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => void projects.refetch()}
          >
            Try again
          </button>
        </Alert>
      ) : !projects.data ? (
        <Skeleton className="h-[172px] rounded-[14px]" />
      ) : all.length === 0 ? (
        <NoProjects />
      ) : (
        <div className="rise flex flex-col gap-3 [animation-delay:80ms]">
          <TaskComposer
            text={text}
            onTextChange={setText}
            projects={pickable}
            projectId={projectId}
            onProjectChange={(id) => {
              setChosenId(id);
              setBranch(null);
              startTask.reset();
            }}
            branch={baseBranch}
            onBranchChange={setBranch}
            branchError={branchError}
            canStart={Boolean(text.trim()) && Boolean(project) && !branchError}
            starting={startTask.isPending}
            error={
              startTask.error && projectId
                ? startTaskError(startTask.error, projectId)
                : null
            }
            onStart={start}
          />
          {!projectId && <NoReadyProject projects={pickable} />}
          <p className="text-center text-[13px] text-faint">
            Specific tasks work best: &quot;Add pagination to GET /orders (page
            and pageSize, default 20), with tests&quot; beats &quot;improve the
            orders page&quot;.
          </p>
        </div>
      )}

      {all.length > 0 && (
        <div className="rise [animation-delay:160ms]">
          <RecentTasks
            tasks={(tasks.data ?? []).slice(0, RECENT).map((task) => ({
              id: task.id,
              href: taskPath(task.id),
              title: task.title,
              projectName: task.project.name,
              label: task.label,
              prNumber: task.pullRequest?.number ?? null,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function NoProjects() {
  return (
    <div className="rise flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-7 text-center [animation-delay:80ms]">
      <p className="font-medium">Add a repository first</p>
      <p className="max-w-[420px] text-[13px] text-muted-foreground">
        CodeGenie works on a project: a repository you&apos;ve added and set up.
        It takes a few minutes, once per repository.
      </p>
      <Button asChild variant="primary" size="sm" glow>
        <Link href={ADD_REPOSITORY}>
          <Icon icon={Plus} size={14} />
          Add a repository
        </Link>
      </Button>
    </div>
  );
}

function NoReadyProject({ projects }: { projects: PickerProject[] }) {
  const fixable = projects.find((project) => project.blocked?.fix);
  const fix = fixable?.blocked?.fix;
  return (
    <Alert tone="info">
      None of your projects can take a task yet.
      {fixable && fix && (
        <>
          {" "}
          <Link
            href={fix.href}
            className="font-medium underline underline-offset-2"
          >
            {fix.label} {fixable.name}
          </Link>
        </>
      )}
    </Alert>
  );
}
