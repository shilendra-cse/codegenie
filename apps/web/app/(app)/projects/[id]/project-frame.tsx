"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Alert } from "@/components/atoms/alert";
import { Skeleton } from "@/components/atoms/skeleton";
import { NeedsAttentionBanner } from "@/components/organisms/needs-attention-banner";
import { ProjectTabs } from "@/components/templates/project-tabs";
import { repositoryUrl } from "@/features/github/links";
import { isSettingUp, useProject } from "@/features/projects/projects";
import { useStartOnboarding } from "@/features/setup/use-onboarding";
import { environmentPath, INBOX, newTaskPath, projectPath } from "@/lib/routes";

export type ProjectFrameProps = { projectId: string; children: ReactNode };

export function ProjectFrame({ projectId, children }: ProjectFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { project, isPending, isError, refetch } = useProject(projectId);
  const rerun = useStartOnboarding(projectId);

  if (isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4 px-6 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-64" />
      </div>
    );
  }
  if (isError || !project) {
    return (
      <div className="mx-auto w-full max-w-[780px] px-6 py-10">
        <Alert tone="error">
          {isError ? (
            <>
              Couldn&apos;t load this project.{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => void refetch()}
              >
                Try again
              </button>
            </>
          ) : (
            <>
              This project doesn&apos;t exist or isn&apos;t yours.{" "}
              <Link
                href={INBOX}
                className="font-medium underline underline-offset-2"
              >
                Go to the Inbox
              </Link>
            </>
          )}
        </Alert>
      </div>
    );
  }

  const { owner, name } = project.repo;
  const attention = project.environment?.health === "needs_attention";
  const environment = environmentPath(projectId);

  return (
    <ProjectTabs
      name={name}
      fullName={`${owner}/${name}`}
      repositoryUrl={repositoryUrl(owner, name)}
      newTaskHref={newTaskPath(projectId)}
      tabs={[
        {
          label: "Tasks",
          href: projectPath(projectId),
          active: pathname === projectPath(projectId),
        },
        {
          label: "Environment",
          href: environment,
          active: pathname === environment,
          attention,
        },
      ]}
      banner={
        attention &&
        !isSettingUp(project) && (
          <NeedsAttentionBanner
            reasons={project.environment?.healthReasons ?? []}
            rerunning={rerun.isPending}
            error={rerun.error && "Couldn't start the setup. Try again."}
            onRerun={() =>
              rerun.mutate(undefined, {
                onSuccess: () => router.push(environment),
              })
            }
          />
        )
      }
    >
      {children}
    </ProjectTabs>
  );
}
