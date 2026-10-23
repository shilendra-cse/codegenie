import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-border text-muted-foreground",
  progress: "border-primary-border bg-primary-soft text-primary-text",
  ok: "border-ok-border bg-ok-soft text-ok",
  warn: "border-warn-border bg-warn-soft text-warn",
  err: "border-err-border bg-err-soft text-err",
  merged: "border-merged-border bg-merged-soft text-merged",
} as const;

export type BadgeProps = {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
