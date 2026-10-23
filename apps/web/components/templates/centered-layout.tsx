import type { ReactNode } from "react";
import { Glow } from "@/components/atoms/glow";
import { GridBackdrop } from "@/components/atoms/grid-backdrop";

export function CenteredLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      <GridBackdrop focus="center" />
      <Glow className="top-[48%] h-[440px] w-[min(720px,100%)] -translate-y-1/2" />
      {children}
    </main>
  );
}
