import type { ReactNode } from "react";

export function CenteredLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      {children}
    </main>
  );
}
