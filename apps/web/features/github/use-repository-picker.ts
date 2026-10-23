import { useState } from "react";
import {
  addProjectError,
  useCreateProject,
} from "@/features/projects/create-project";
import { useInstallations } from "./installations";
import { type InstallReturn, installUrlFor, manageAccessUrl } from "./links";
import { useRepositories } from "./repositories";

/** Everything the repository picker shows and does, for whichever page holds it. */
export function useRepositoryPicker({
  returnTo,
  enabled = true,
}: { returnTo?: InstallReturn; enabled?: boolean } = {}) {
  const installations = useInstallations();
  const [pickedId, setPickedId] = useState<number>();
  const list = installations.data?.installations;
  const selected = list?.find((i) => i.id === pickedId) ?? list?.[0];
  const repositories = useRepositories(enabled ? selected?.id : undefined);
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

  const installUrl = installations.data?.installUrl ?? "";
  return {
    installations: list,
    selectedId: selected?.id,
    onSelect: setPickedId,
    repositories: repositories.data,
    failed: installations.isError || repositories.isError,
    onRetry: () =>
      void (installations.isError
        ? installations.refetch()
        : repositories.refetch()),
    installUrl:
      installUrl && returnTo ? installUrlFor(installUrl, returnTo) : installUrl,
    manageUrl: selected && manageAccessUrl(selected),
    adding,
    errors,
    onAdd: (repoId: number) => void add(repoId),
  };
}
