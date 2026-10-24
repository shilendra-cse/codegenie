import type { TaskLabel } from "@codegenie/shared";
import Link from "next/link";
import { TaskStatusBadge } from "@/components/molecules/task-status-badge";

export type RecentTask = {
  id: string;
  href: string;
  title: string;
  projectName: string;
  label: TaskLabel;
  prNumber: number | null;
};

export type RecentTasksProps = { tasks: RecentTask[] };

export function RecentTasks({ tasks }: RecentTasksProps) {
  if (tasks.length === 0) return null;
  return (
    <section aria-labelledby="recent-tasks" className="flex flex-col gap-1.5">
      <h2 id="recent-tasks" className="px-3 text-xs font-medium text-faint">
        Recent tasks
      </h2>
      <ul className="flex flex-col">
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href={task.href}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {task.title}
              </span>
              <span className="text-[13px] text-faint">{task.projectName}</span>
              <TaskStatusBadge label={task.label} prNumber={task.prNumber} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
