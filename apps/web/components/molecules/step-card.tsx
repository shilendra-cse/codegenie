import type { ReactNode } from "react";

export type StepCardProps = {
  number: string;
  title: string;
  children: ReactNode;
};

export function StepCard({ number, title, children }: StepCardProps) {
  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-2.5 rounded-lg border border-border bg-card p-6">
      <span className="font-mono text-xs text-faint">{number}</span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
