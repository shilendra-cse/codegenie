import type { ReactNode } from "react";

export type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="flex flex-[1_1_240px] flex-col border-r border-border bg-surface">
        {sidebar}
      </aside>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col">
        {children}
      </main>
    </div>
  );
}
