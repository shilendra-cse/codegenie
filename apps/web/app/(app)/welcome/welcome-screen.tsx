"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, type AlertProps } from "@/components/atoms/alert";
import { WelcomeChecklist } from "@/components/organisms/welcome-checklist";
import { useAccount } from "@/features/account/use-account";
import { useWelcomeChecklist } from "@/features/onboarding/use-welcome-checklist";
import { APP_HOME } from "@/lib/routes";

const NOTICES: Record<string, { tone: AlertProps["tone"]; text: string }> = {
  installed: { tone: "ok", text: "GitHub App installed." },
  requested: {
    tone: "info",
    text: "Installation requested. An owner of the organisation needs to approve it.",
  },
  cancelled: { tone: "info", text: "Installation cancelled." },
  "not-found": {
    tone: "warn",
    text: "We couldn't find that installation on your account.",
  },
};

export type WelcomeScreenProps = { github?: string };

export function WelcomeScreen({ github }: WelcomeScreenProps) {
  const router = useRouter();
  const { account } = useAccount();
  const checklist = useWelcomeChecklist();
  // Kept in state so the notice outlives the address change below.
  const [notice] = useState(() =>
    github && Object.hasOwn(NOTICES, github) ? NOTICES[github] : null,
  );
  const firstName = account?.name.trim().split(/\s+/)[0];
  const checklistView =
    checklist.status === "ready"
      ? { status: checklist.status, steps: checklist.steps }
      : checklist.status === "error"
        ? { status: checklist.status, onRetry: checklist.retry }
        : { status: checklist.status };

  useEffect(() => {
    if (github !== undefined) router.replace(APP_HOME, { scroll: false });
  }, [github, router]);

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
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <WelcomeChecklist {...checklistView} />
      <p className="text-[13px] text-faint">
        CodeGenie works best on JavaScript and TypeScript repositories whose
        install, lint, type-check and tests run without outside services.
      </p>
    </div>
  );
}
