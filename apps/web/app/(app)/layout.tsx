"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { AccountMenu } from "@/components/organisms/account-menu";
import { Sidebar } from "@/components/organisms/sidebar";
import { AppShell } from "@/components/templates/app-shell";
import { useAccount } from "@/features/account/use-account";
import { toSidebarProject, useProjects } from "@/features/projects/projects";
import { SIGN_IN } from "@/lib/routes";

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { account, pending, signingOut, signOut } = useAccount();
  const projects = useProjects();

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
          projects={projects.data?.map(toSidebarProject)}
          projectsFailed={projects.isError}
          account={
            <AccountMenu
              user={account}
              theme={theme}
              onThemeChange={setTheme}
              onSignOut={() => void signOut()}
            />
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
