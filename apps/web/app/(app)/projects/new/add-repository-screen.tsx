"use client";

import { InstallNotice } from "@/components/molecules/install-notice";
import { RepositoryPicker } from "@/components/organisms/repository-picker";
import { TopBar } from "@/components/organisms/top-bar";
import { useRepositoryPicker } from "@/features/github/use-repository-picker";
import { ADD_REPOSITORY } from "@/lib/routes";
import { useInstallOutcome } from "../../use-install-outcome";

export type AddRepositoryScreenProps = { github?: string };

export function AddRepositoryScreen({ github }: AddRepositoryScreenProps) {
  const outcome = useInstallOutcome(github, ADD_REPOSITORY);
  const picker = useRepositoryPicker({ returnTo: "add-repo" });

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
          <RepositoryPicker {...picker} />
        </div>
      </div>
    </>
  );
}
