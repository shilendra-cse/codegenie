"use client";

import type { EnvironmentSource, OnboardingResponse } from "@codegenie/shared";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Skeleton } from "@/components/atoms/skeleton";
import { VersionRow } from "@/components/molecules/version-row";
import { EnvironmentSummary } from "@/components/organisms/environment-summary";
import {
  restoreErrorMessage,
  useRestoreEnvironment,
} from "@/features/projects/use-restore-environment";
import {
  isSetupActive,
  useEnvironments,
  useOnboarding,
  useStartOnboarding,
} from "@/features/setup/use-onboarding";
import { timeAgo } from "@/lib/format";
import { environmentPath } from "@/lib/routes";
import { SetupScreen } from "./setup-screen";

const MADE_BY: Record<EnvironmentSource, string> = {
  detected: "Detected from the repository",
  ai: "Set up by CodeGenie",
  user: "Set by you",
  mixed: "Set up by CodeGenie with your answers",
};

function unfinishedReason(onboarding: OnboardingResponse | null | undefined) {
  if (onboarding?.status === "cancelled") return "you stopped it";
  if (onboarding?.status === "failed") {
    return (onboarding.error?.message ?? "it failed").replace(/\.$/, "");
  }
  return null;
}

export type EnvironmentScreenProps = { projectId: string; view?: string };

export function EnvironmentScreen({ projectId, view }: EnvironmentScreenProps) {
  const latest = useOnboarding(projectId);
  const environments = useEnvironments(projectId);
  const rerun = useStartOnboarding(projectId);
  const restore = useRestoreEnvironment(projectId);
  const [confirming, setConfirming] = useState<number | null>(null);
  const onboarding = latest.data;
  const settingUp = isSetupActive(onboarding);
  // Someone who watched the setup finish stays on it, to see what was saved.
  const [watched, setWatched] = useState(false);
  if (settingUp && !watched) setWatched(true);

  if (latest.isPending || environments.isPending) {
    return (
      <div aria-busy className="flex flex-col gap-4 px-6 py-5">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }
  if (latest.isError || environments.isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-2.5 px-6 py-16 text-center"
      >
        <span className="font-semibold">
          Couldn&apos;t load the environment
        </span>
        <Button
          size="sm"
          onClick={() => {
            void latest.refetch();
            void environments.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const active = environments.data.find((environment) => environment.active);
  if (!active || settingUp || watched || view === "setup") {
    return <SetupScreen projectId={projectId} />;
  }

  const unfinished = unfinishedReason(onboarding);
  return (
    <div className="mx-auto w-full max-w-[780px] px-6 pt-8 pb-20">
      <EnvironmentSummary
        environment={active}
        savedAgo={timeAgo(active.savedAt)}
        onRerun={() => rerun.mutate()}
        rerunning={rerun.isPending}
        rerunError={rerun.error && "Couldn't start the setup. Try again."}
        notice={
          unfinished && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border px-3.5 py-3"
            >
              <span className="flex-[1_1_320px]">
                The last setup didn&apos;t finish:{" "}
                <span className="text-muted-foreground">{unfinished}.</span> New
                tasks still use v{active.version}.
              </span>
              <Button asChild size="sm">
                <Link href={`${environmentPath(projectId)}?view=setup`}>
                  View it
                </Link>
              </Button>
            </div>
          )
        }
      />
      <section aria-labelledby="versions" className="mt-5 flex flex-col gap-2">
        <h3 id="versions" className="text-[13px] font-medium text-faint">
          Versions
        </h3>
        <div className="rounded-lg border border-border bg-card">
          {environments.data.map((environment) => (
            <VersionRow
              key={environment.version}
              version={environment.version}
              active={environment.active}
              activeVersion={active.version}
              made={MADE_BY[environment.source]}
              when={timeAgo(environment.savedAt)}
              confirming={confirming === environment.version}
              restoring={
                restore.isPending && restore.variables === environment.version
              }
              error={
                restore.isError && restore.variables === environment.version
                  ? restoreErrorMessage(restore.error, environment.version)
                  : null
              }
              onRestore={() => {
                restore.reset();
                setConfirming(environment.version);
              }}
              onCancel={() => setConfirming(null)}
              onConfirm={() =>
                restore.mutate(environment.version, {
                  onSuccess: () => setConfirming(null),
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
