"use client";

import { useState } from "react";
import { InstallNotice } from "@/components/molecules/install-notice";
import { RepositoryPicker } from "@/components/organisms/repository-picker";
import { TopBar } from "@/components/organisms/top-bar";
import { useInstallations } from "@/features/github/installations";
import { installUrlFor, manageAccessUrl } from "@/features/github/links";
import { useRepositories } from "@/features/github/repositories";
import {
  addProjectError,
  useCreateProject,
} from "@/features/projects/create-project";
import { ADD_REPOSITORY } from "@/lib/routes";
import { useInstallOutcome } from "../../use-install-outcome";

export type AddRepositoryScreenProps = { github?: string };

export function AddRepositoryScreen({ github }: AddRepositoryScreenProps) {
  const outcome = useInstallOutcome(github, ADD_REPOSITORY);
  const installations = useInstallations();
  const [pickedId, setPickedId] = useState<number>();
  const list = installations.data?.installations;
  const selected = list?.find((i) => i.id === pickedId) ?? list?.[0];
  const repositories = useRepositories(selected?.id);
  const createProject = useCreateProject();
  // Per repository, so several Adds in a row each show their own state.
  const [adding, setAdding] = useState(new Set<number>());
  const [errors, setErrors] = useState(new Map<number, string>());

  const add = async (repoId: number) => {
    if (!selected) return;
    setAdding((ids) => new Set(ids).add(repoId));
    setErrors((all) => new Map([...all].filter(([id]) => id !== repoId)));
    try {
      await createProject.mutateAsync({ installationId: selected.id, repoId });
    } catch (error) {
      setErrors((all) => new Map(all).set(repoId, addProjectError(error)));
    } finally {
      setAdding((ids) => new Set([...ids].filter((id) => id !== repoId)));
    }
  };

  return (
    <>
      <TopBar title="Add a repository" />
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 px-6 pt-10 pb-16">
        <div className="rise flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.015em]">
            Choose a repository
          </h1>
          <p className="text-muted-foreground">
            Only repositories you gave the CodeGenie GitHub App access to appear
            here.
          </p>
        </div>
        <InstallNotice outcome={outcome} />
        <div className="rise [animation-delay:80ms]">
          <RepositoryPicker
            installations={list}
            selectedId={selected?.id}
            onSelect={setPickedId}
            repositories={repositories.data}
            failed={installations.isError || repositories.isError}
            onRetry={() =>
              void (installations.isError
                ? installations.refetch()
                : repositories.refetch())
            }
            installUrl={
              installations.data
                ? installUrlFor(installations.data.installUrl, "add-repo")
                : ""
            }
            manageUrl={selected && manageAccessUrl(selected)}
            adding={adding}
            errors={errors}
            onAdd={(repoId) => void add(repoId)}
          />
        </div>
      </div>
    </>
  );
}
