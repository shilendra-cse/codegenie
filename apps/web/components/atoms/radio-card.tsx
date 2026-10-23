import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type RadioCardProps = {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
};

/** A choice as a card; a real radio underneath, so keyboards and screen readers treat it as one. */
export function RadioCard({
  name,
  checked,
  onSelect,
  children,
}: RadioCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-[10px] border bg-card px-3.5 py-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary",
        checked
          ? "border-primary bg-primary-soft"
          : "border-border hover:border-border-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px]",
          checked ? "border-primary" : "border-border-strong",
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
    </label>
  );
}
