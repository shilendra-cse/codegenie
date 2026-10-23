import type { ProjectResponse } from "@codegenie/shared";

export type ChecklistStepId = "install" | "add-repo" | "set-up" | "first-task";

export type ChecklistStep = {
  id: ChecklistStepId;
  state: "done" | "current" | "todo";
  href: string;
  external: boolean;
};

export type ChecklistInput = {
  installUrl: string;
  hasInstallation: boolean;
  projects: Pick<ProjectResponse, "id" | "environment">[];
  hasTasks: boolean;
};

export function buildChecklist({
  installUrl,
  hasInstallation,
  projects,
  hasTasks,
}: ChecklistInput): ChecklistStep[] {
  const needsSetUp = projects.find((project) => !project.environment);
  const steps = [
    { id: "install", done: hasInstallation, href: installUrl, external: true },
    {
      id: "add-repo",
      done: projects.length > 0,
      href: "/projects/new",
      external: false,
    },
    {
      id: "set-up",
      done: projects.some((project) => project.environment),
      href: needsSetUp
        ? `/projects/${needsSetUp.id}/environment`
        : "/projects/new",
      external: false,
    },
    { id: "first-task", done: hasTasks, href: "/new", external: false },
  ] as const;

  const current = steps.findIndex((step) => !step.done);
  return steps.map(({ done, ...step }, index) => ({
    ...step,
    state: done ? "done" : index === current ? "current" : "todo",
  }));
}
