import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  ok: "border-ok-border bg-ok-soft text-ok",
  error: "border-err-border bg-err-soft text-err",
  warn: "border-warn-border bg-warn-soft text-warn",
  info: "border-border bg-surface text-foreground",
} as const;

export type AlertProps = {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
};

export function Alert({ tone = "info", children, className }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2.5 text-left text-[13px]",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
