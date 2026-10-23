import type { ReactNode } from "react";
import { Glow } from "@/components/atoms/glow";
import { GridBackdrop } from "@/components/atoms/grid-backdrop";

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
      <main className="relative isolate flex min-w-0 flex-[999_1_560px] flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] overflow-hidden">
          <GridBackdrop />
          <Glow soft className="-top-40 h-80 w-[min(760px,100%)]" />
        </div>
        {children}
      </main>
    </div>
  );
}
