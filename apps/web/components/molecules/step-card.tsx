import type { ReactNode } from "react";

export type StepCardProps = {
  number: string;
  title: string;
  children: ReactNode;
};

export function StepCard({ number, title, children }: StepCardProps) {
  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-[translate,border-color,box-shadow] duration-200 hover:-translate-y-[3px] hover:border-border-strong hover:shadow-[0_12px_40px_-12px_var(--glow)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <span className="flex size-[30px] items-center justify-center rounded-md border border-border-strong bg-surface font-mono text-xs">
        {number}
      </span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
