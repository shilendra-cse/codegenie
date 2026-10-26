"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";
import { AccountMenu } from "@/components/organisms/account-menu";
import { GettingStartedCard } from "@/components/organisms/getting-started-card";
import { UsageLine } from "@/components/molecules/usage-line";
import { Sidebar } from "@/components/organisms/sidebar";
import { UsageDialog } from "@/components/organisms/usage-dialog";
import { AppShell } from "@/components/templates/app-shell";
import { useAccount } from "@/features/account/use-account";
import { useWelcomeChecklist } from "@/features/onboarding/use-welcome-checklist";
import { toSidebarProject, useProjects } from "@/features/projects/projects";
import { useOnboarding } from "@/features/setup/use-onboarding";
import { useSetupsNeedingYou } from "@/features/projects/use-setups-needing-you";
import { useTaskCounts, useTasks } from "@/features/tasks/use-tasks";
import { useUsage } from "@/features/usage/use-usage";
import { SIGN_IN, WELCOME } from "@/lib/routes";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { account, pending, signingOut, signOut } = useAccount();
  const projects = useProjects();
  const tasks = useTasks();
  const counts = useTaskCounts();
  const setupsNeedingYou = useSetupsNeedingYou();
  const checklist = useWelcomeChecklist();
  const usage = useUsage();
  const [usageOpen, setUsageOpen] = useState(false);
  // The card is hidden on the welcome page itself, where the checklist is.
  const steps =
    checklist.status === "ready" && pathname !== WELCOME ? checklist.steps : [];
  const next = steps.find((step) => step.state === "current");
  const setupProjectId =
    checklist.status === "ready"
      ? checklist.steps.find((s) => s.id === "set-up" && s.state === "current")
          ?.projectId
      : undefined;
  const setupStatus = useOnboarding(setupProjectId).data?.status;
  const settingUp =
    setupStatus === "waiting"
      ? ("waiting" as const)
      : setupStatus === "running" || setupStatus === "queued"
        ? ("running" as const)
        : undefined;

  // The middleware only sees that a cookie exists; an expired session lands here.
  useEffect(() => {
    if (pending || account || signingOut) return;
    router.replace(`${SIGN_IN}?next=${encodeURIComponent(pathname)}`);
  }, [pending, account, signingOut, pathname, router]);

  return (
    <AppShell
      sidebar={
        <Sidebar
          pathname={pathname}
          projects={projects.data?.map((project) => ({
            ...toSidebarProject(project),
            needsYou:
              project.id === setupProjectId && setupStatus === "waiting",
          }))}
          projectsFailed={projects.isError}
          tasks={tasks.data}
          inboxCount={(counts.data?.running ?? 0) + setupsNeedingYou.length}
          gettingStarted={
            next && (
              <GettingStartedCard
                done={steps.filter((step) => step.state === "done").length}
                next={next.id}
                projectName={next.projectName}
                status={next.id === "set-up" ? settingUp : undefined}
              />
            )
          }
          usage={
            usage.data && (
              <UsageLine usage={usage.data} onOpen={() => setUsageOpen(true)} />
            )
          }
          account={
            <AccountMenu
              user={account}
              theme={theme}
              onThemeChange={setTheme}
              onShowUsage={() => setUsageOpen(true)}
              onSignOut={() => void signOut()}
            />
          }
        />
      }
    >
      {children}
      <UsageDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        usage={usage.data}
        failed={usage.isError}
      />
    </AppShell>
  );
}
