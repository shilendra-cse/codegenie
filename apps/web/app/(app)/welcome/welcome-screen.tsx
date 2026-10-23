"use client";

import { InstallNotice } from "@/components/molecules/install-notice";
import { RepositoryPicker } from "@/components/organisms/repository-picker";
import { WelcomeChecklist } from "@/components/organisms/welcome-checklist";
import { useAccount } from "@/features/account/use-account";
import { useRepositoryPicker } from "@/features/github/use-repository-picker";
import { useWelcomeChecklist } from "@/features/onboarding/use-welcome-checklist";
import { APP_HOME } from "@/lib/routes";
import { useInstallOutcome } from "../use-install-outcome";

export type WelcomeScreenProps = { github?: string };

export function WelcomeScreen({ github }: WelcomeScreenProps) {
  const { account } = useAccount();
  const checklist = useWelcomeChecklist();
  const addingRepository =
    checklist.status === "ready" &&
    checklist.steps.some((s) => s.id === "add-repo" && s.state === "current");
  const picker = useRepositoryPicker({ enabled: addingRepository });
  const outcome = useInstallOutcome(github, APP_HOME);
  const firstName = account?.name.trim().split(/\s+/)[0];
  const checklistView =
    checklist.status === "ready"
      ? {
          status: checklist.status,
          steps: checklist.steps,
          panels: { "add-repo": <RepositoryPicker {...picker} /> },
        }
      : checklist.status === "error"
        ? { status: checklist.status, onRetry: checklist.retry }
        : { status: checklist.status };

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-7 px-6 py-[72px]">
      <div className="rise flex flex-col gap-2">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
          {firstName ? `Welcome, ${firstName}` : "Welcome"}
        </h1>
        <p className="text-[15px] text-muted-foreground">
          A few steps and CodeGenie is ready to work on your code.
        </p>
      </div>
      <InstallNotice outcome={outcome} />
      <WelcomeChecklist {...checklistView} />
      <p className="text-[13px] text-faint">
        CodeGenie works best on JavaScript and TypeScript repositories whose
        install, lint, type-check and tests run without outside services.
      </p>
    </div>
  );
}
