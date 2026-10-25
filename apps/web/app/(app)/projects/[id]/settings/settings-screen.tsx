"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/atoms/button";
import { RemoveProjectDialog } from "@/components/organisms/remove-project-dialog";
import { manageAccessUrl, repositoryUrl } from "@/features/github/links";
import { useProject } from "@/features/projects/projects";
import {
  removeProjectErrorMessage,
  useRemoveProject,
} from "@/features/projects/use-remove-project";
import { useTaskPages } from "@/features/tasks/use-task-pages";
import { INBOX } from "@/lib/routes";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-b border-border px-[18px] py-4 last:border-b-0">
      <span className="flex-[0_0_200px] font-medium">{label}</span>
      <span className="min-w-0 flex-[1_1_280px]">{children}</span>
    </div>
  );
}

export type SettingsScreenProps = { projectId: string };

export function SettingsScreen({ projectId }: SettingsScreenProps) {
  const router = useRouter();
  const { project } = useProject(projectId);
  const taskCount = useTaskPages({ projectId }).counts?.all;
  const remove = useRemoveProject();
  const [asking, setAsking] = useState(false);

  if (!project) return null;
  const { owner, name } = project.repo;
  const { installation } = project;

  return (
    <div className="flex w-full max-w-[900px] flex-col gap-5 px-6 pt-5 pb-12">
      <div className="rounded-lg border border-border bg-card">
        <Field label="Repository">
          <a
            href={repositoryUrl(owner, name)}
            target="_blank"
            rel="noreferrer"
            className="font-mono hover:underline"
          >
            {owner}/{name}
          </a>
        </Field>
        <Field label="Default branch">
          <span className="font-mono">{project.defaultBranch}</span>{" "}
          <span className="text-faint">
            · new tasks start from it; follows GitHub
          </span>
        </Field>
        <Field label="GitHub access">
          Through the CodeGenie app installed on{" "}
          <strong className="font-semibold">{installation.accountLogin}</strong>
          .{" "}
          <a
            href={manageAccessUrl(installation)}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            Manage on GitHub
          </a>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 rounded-lg border border-border bg-card px-[18px] py-4">
        <span className="flex-[0_0_200px] font-medium">Remove project</span>
        <span className="min-w-0 flex-[1_1_280px] text-muted-foreground">
          Deletes its tasks, runs and environment from CodeGenie. The repository
          and its pull requests on GitHub are not touched.
        </span>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            remove.reset();
            setAsking(true);
          }}
        >
          Remove project
        </Button>
      </div>
      <RemoveProjectDialog
        open={asking}
        onOpenChange={setAsking}
        projectName={name}
        taskCount={taskCount}
        removing={remove.isPending}
        error={remove.isError ? removeProjectErrorMessage(remove.error) : null}
        onRemove={() =>
          remove.mutate(projectId, { onSuccess: () => router.replace(INBOX) })
        }
      />
    </div>
  );
}
