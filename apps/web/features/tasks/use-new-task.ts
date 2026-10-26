import type { CreatedTask, ProjectResponse } from "@hobai/shared";
import { useState } from "react";
import { SHORT_NAME } from "@hobai/shared/brand";
import { useBranches } from "@/features/projects/branches";
import { toSidebarProject } from "@/features/projects/projects";
import { useUsage } from "@/features/usage/use-usage";
import { ApiError } from "@/lib/api/client";
import { defaultProjectId, startTaskError, taskReadiness } from "./start-task";
import { useStartTask } from "./use-tasks";

const LAST_PROJECT = `${SHORT_NAME}:last-project`;

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

export const toPickerProject = (project: ProjectResponse) => {
  const readiness = taskReadiness(project);
  return {
    ...toSidebarProject(project),
    branch: project.defaultBranch,
    blocked: readiness.ready ? null : readiness,
  };
};

/**
 * What a task composer needs: the text, the project (the one asked for, else the last used, else
 * the first ready), the base branch, and starting. Shared by New task and Welcome's last step.
 */
export function useNewTask({
  projects,
  preferredProjectId,
  onStarted,
}: {
  projects: ProjectResponse[];
  preferredProjectId?: string;
  onStarted?: (created: CreatedTask) => void;
}) {
  const [text, setText] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [wantsBranches, setWantsBranches] = useState(false);

  const projectId =
    chosenId ?? defaultProjectId(projects, [preferredProjectId, lastProject()]);
  const project = projects.find((p) => p.id === projectId);
  const startTask = useStartTask(projectId ?? "");
  const usage = useUsage().data;
  const runLimit =
    usage && usage.runs.limit !== null && usage.runs.used >= usage.runs.limit
      ? { limit: usage.runs.limit, resetsAt: usage.resetsAt }
      : null;

  const defaultBranch = project?.defaultBranch ?? "";
  const baseBranch = branch ?? defaultBranch;
  const branches = useBranches(projectId, wantsBranches);

  return {
    text,
    onTextChange: setText,
    projects: projects.map(toPickerProject),
    projectId,
    onProjectChange: (id: string) => {
      setChosenId(id);
      setBranch(null);
      startTask.reset();
    },
    branch: {
      value: baseBranch,
      defaultBranch,
      branches: branches.data?.branches,
      truncated: branches.data?.truncated ?? false,
      loading: branches.isFetching && !branches.data,
      error: branches.error
        ? branches.error instanceof ApiError
          ? branches.error.message
          : "Couldn't load the branches."
        : null,
      onOpen: () => setWantsBranches(true),
      onRetry: () => void branches.refetch(),
      onChange: setBranch,
    },
    canStart: Boolean(text.trim()) && Boolean(project),
    // Still busy once started: the screen is about to change (the task opens, or Welcome moves on).
    starting: startTask.isPending || startTask.isSuccess,
    // At the limit the banner says why; the refusal it came with would only repeat it.
    error:
      startTask.error && projectId && !runLimit
        ? startTaskError(startTask.error, projectId)
        : null,
    runLimit,
    onStart: () => {
      if (!projectId) return;
      startTask.mutate(
        { prompt: text, baseBranch },
        {
          onSuccess: (created) => {
            rememberProject(projectId);
            onStarted?.(created);
          },
        },
      );
    },
  };
}
