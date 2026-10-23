import type { ReactNode } from "react";

export type TopBarProps = { title: string; children?: ReactNode };

export function TopBar({ title, children }: TopBarProps) {
  return (
    <header className="relative z-10 flex min-h-[52px] flex-wrap items-center gap-2.5 border-b border-border bg-background px-6 py-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </header>
  );
}
