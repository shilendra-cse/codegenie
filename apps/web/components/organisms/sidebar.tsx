import type { TaskLabel } from "@codegenie/shared";
import { Inbox, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import {
  type Health,
  HEALTH_LABELS,
  HealthDot,
} from "@/components/atoms/health-dot";
import { Icon } from "@/components/atoms/icon";
import { Logo } from "@/components/atoms/logo";
import { Skeleton } from "@/components/atoms/skeleton";
import { NavItem } from "@/components/molecules/nav-item";
import {
  TASK_STATUS_TEXT,
  TaskStatusIcon,
} from "@/components/molecules/task-status-icon";
import {
  ADD_REPOSITORY,
  APP_HOME,
  INBOX,
  NEW_TASK,
  projectPath,
  taskPath,
} from "@/lib/routes";

export type SidebarProject = {
  id: string;
  name: string;
  health: Health;
  /** Its setup is waiting for the user's answer. */
  needsYou?: boolean;
};

export type SidebarTask = { id: string; title: string; label: TaskLabel };

export type SidebarProps = {
  pathname: string;
  projects: SidebarProject[] | undefined;
  projectsFailed: boolean;
  /** Your latest tasks, newest first. */
  tasks?: SidebarTask[];
  inboxCount?: number;
  /** Shown above the account until the first-run steps are done. */
  gettingStarted?: ReactNode;
  account: ReactNode;
};

function ProjectList({
  pathname,
  projects,
  projectsFailed,
}: Pick<SidebarProps, "pathname" | "projects" | "projectsFailed">) {
  const note = "px-2.5 py-1 text-[13px] text-faint";
  if (projectsFailed)
    return <p className={note}>Couldn&apos;t load projects.</p>;
  if (!projects) {
    return (
      <div aria-hidden className="flex flex-col gap-2 px-2.5 py-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }
  return (
    <>
      {projects.length === 0 && <p className={note}>No projects yet.</p>}
      {projects.map((project) => {
        const href = projectPath(project.id);
        return (
          <NavItem
            key={project.id}
            href={href}
            label={`${project.name}, ${
              project.needsYou
                ? "needs your answer"
                : HEALTH_LABELS[project.health].toLowerCase()
            }`}
            trailing={
              project.needsYou && (
                <span className="text-xs font-medium text-primary-text">
                  Needs you
                </span>
              )
            }
            leading={<HealthDot health={project.health} />}
            active={pathname === href || pathname.startsWith(`${href}/`)}
          >
            {project.name}
          </NavItem>
        );
      })}
      {pathname === ADD_REPOSITORY && (
        <NavItem href={ADD_REPOSITORY} icon={Plus} active>
          Add repository
        </NavItem>
      )}
    </>
  );
}

const RECENT = 10;

export function Sidebar({
  account,
  gettingStarted,
  tasks,
  inboxCount = 0,
  ...projects
}: SidebarProps) {
  const recent = (tasks ?? []).slice(0, RECENT);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 p-3">
      <Link
        href={APP_HOME}
        aria-label="CodeGenie home"
        className="self-start px-2.5 pt-1.5 pb-3.5"
      >
        <Logo />
      </Link>
      <Button
        asChild
        className="w-full justify-start aria-[current=page]:bg-muted"
      >
        <Link
          href={NEW_TASK}
          aria-current={projects.pathname === NEW_TASK ? "page" : undefined}
        >
          <Icon icon={Plus} />
          New task
        </Link>
      </Button>
      <nav
        aria-label="Main"
        className="mt-2 flex min-h-0 flex-1 flex-col gap-0.5"
      >
        <NavItem
          href={INBOX}
          icon={Inbox}
          active={projects.pathname.startsWith(INBOX)}
          label={
            inboxCount > 0
              ? `Inbox, ${inboxCount} running or waiting for you`
              : undefined
          }
          trailing={
            inboxCount > 0 && (
              <span className="text-xs font-medium text-faint">
                {inboxCount}
              </span>
            )
          }
        >
          Inbox
        </NavItem>
        <div className="flex items-center justify-between pt-[18px] pr-1 pb-1.5 pl-2.5">
          <h2 className="text-xs font-medium text-faint">Projects</h2>
          <Link
            href={ADD_REPOSITORY}
            aria-label="Add a repository"
            className="rounded-sm p-1 text-faint hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Icon icon={Plus} size={14} />
          </Link>
        </div>
        <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          <ProjectList {...projects} />
          {recent.length > 0 && (
            <>
              <h2 className="pt-[18px] pb-1.5 pl-2.5 text-xs font-medium text-faint">
                Recent
              </h2>
              {recent.map((task) => {
                const href = taskPath(task.id);
                return (
                  <NavItem
                    key={task.id}
                    href={href}
                    label={`${task.title}, ${TASK_STATUS_TEXT[task.label]}`}
                    leading={<TaskStatusIcon status={task.label} />}
                    active={projects.pathname === href}
                  >
                    {task.title}
                  </NavItem>
                );
              })}
            </>
          )}
        </div>
      </nav>
      {gettingStarted && <div className="mt-3">{gettingStarted}</div>}
      <div className="mt-3">{account}</div>
    </div>
  );
}
