"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import type { PickerProject } from "@/components/molecules/project-picker";
import { RecentTasks } from "@/components/organisms/recent-tasks";
import { TaskComposer } from "@/components/organisms/task-composer";
import { useProjects } from "@/features/projects/projects";
import { useNewTask } from "@/features/tasks/use-new-task";
import { useTasks } from "@/features/tasks/use-tasks";
import { ADD_REPOSITORY, taskPath } from "@/lib/routes";

const RECENT = 5;

export type NewTaskScreenProps = { projectId?: string };

export function NewTaskScreen({ projectId: requested }: NewTaskScreenProps) {
  const router = useRouter();
  const projects = useProjects();
  const tasks = useTasks();
  const all = projects.data ?? [];
  const composer = useNewTask({
    projects: all,
    preferredProjectId: requested,
    onStarted: (created) => router.push(taskPath(created.task.id)),
  });

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
          <TaskComposer {...composer} />
          {!composer.projectId && (
            <NoReadyProject projects={composer.projects} />
          )}
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
