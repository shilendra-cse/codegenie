import type { ProjectResponse } from "@codegenie/shared";
import { ADD_REPOSITORY, projectPath } from "@/lib/routes";

export type ChecklistStepId = "install" | "add-repo" | "set-up" | "first-task";

export type ChecklistStep = {
  id: ChecklistStepId;
  state: "done" | "current" | "todo";
  href: string;
  external: boolean;
  /** The project a repository or setup step is about, once there is one. */
  projectName?: string;
};

export type ChecklistInput = {
  installUrl: string;
  hasInstallation: boolean;
  projects: Pick<ProjectResponse, "id" | "repo" | "environment">[];
  hasTasks: boolean;
};

export function buildChecklist({
  installUrl,
  hasInstallation,
  projects,
  hasTasks,
}: ChecklistInput): ChecklistStep[] {
  const needsSetUp = projects.find((project) => !project.environment);
  const ready = projects.find((project) => project.environment);
  const steps: (Omit<ChecklistStep, "state"> & { done: boolean })[] = [
    { id: "install", done: hasInstallation, href: installUrl, external: true },
    {
      id: "add-repo",
      done: projects.length > 0,
      href: ADD_REPOSITORY,
      external: false,
      projectName: projects[0]?.repo.name,
    },
    {
      id: "set-up",
      done: projects.some((project) => project.environment),
      href: needsSetUp
        ? `${projectPath(needsSetUp.id)}/environment`
        : ADD_REPOSITORY,
      external: false,
      projectName: (ready ?? needsSetUp)?.repo.name,
    },
    { id: "first-task", done: hasTasks, href: "/new", external: false },
  ];

  const current = steps.findIndex((step) => !step.done);
  return steps.map(({ done, ...step }, index) => ({
    ...step,
    state: done ? "done" : index === current ? "current" : "todo",
  }));
}
