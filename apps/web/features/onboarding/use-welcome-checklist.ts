import { useInstallations } from "@/features/github/installations";
import { useProjects } from "@/features/projects/projects";
import { useHasTasks } from "@/features/tasks/tasks";
import { buildChecklist, type ChecklistStep } from "./checklist";

export type WelcomeChecklist =
  | { status: "pending" | "error"; steps: null; retry: () => void }
  | { status: "ready"; steps: ChecklistStep[]; retry: () => void };

export function useWelcomeChecklist(): WelcomeChecklist {
  const installations = useInstallations();
  const projects = useProjects();
  const hasTasks = useHasTasks();
  const queries = [installations, projects, hasTasks];

  const retry = () => {
    for (const query of queries) if (query.isError) void query.refetch();
  };

  if (queries.some((query) => query.isError)) {
    return { status: "error", steps: null, retry };
  }
  if (!installations.data || !projects.data || hasTasks.data === undefined) {
    return { status: "pending", steps: null, retry };
  }
  return {
    status: "ready",
    steps: buildChecklist({
      installUrl: installations.data.installUrl,
      hasInstallation: installations.data.installations.length > 0,
      projects: projects.data,
      hasTasks: hasTasks.data,
    }),
    retry,
  };
}
