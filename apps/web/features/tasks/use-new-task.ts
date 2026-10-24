import {
  type CreatedTask,
  createTaskSchema,
  type ProjectResponse,
} from "@codegenie/shared";
import { useState } from "react";
import { toSidebarProject } from "@/features/projects/projects";
import { defaultProjectId, startTaskError, taskReadiness } from "./start-task";
import { useStartTask } from "./use-tasks";

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

  const projectId =
    chosenId ?? defaultProjectId(projects, [preferredProjectId, lastProject()]);
  const project = projects.find((p) => p.id === projectId);
  const startTask = useStartTask(projectId ?? "");

  const baseBranch = branch ?? project?.defaultBranch ?? "";
  const branchCheck = createTaskSchema.shape.baseBranch.safeParse(baseBranch);
  const branchError =
    branch !== null && !branchCheck.success
      ? (branchCheck.error.issues[0]?.message ?? "Not a valid branch name.")
      : null;

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
    branch: baseBranch,
    onBranchChange: setBranch,
    branchError,
    canStart: Boolean(text.trim()) && Boolean(project) && !branchError,
    starting: startTask.isPending,
    error:
      startTask.error && projectId
        ? startTaskError(startTask.error, projectId)
        : null,
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
