import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export type StepMarkerProps = {
  number: number;
  state: "done" | "current" | "todo";
};

const states = {
  done: "border-transparent bg-ok-soft text-ok",
  current: "border-primary bg-primary-soft text-primary-text",
  todo: "border-border-strong bg-card text-faint",
} as const;

export function StepMarker({ number, state }: StepMarkerProps) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold",
        states[state],
      )}
    >
      {state === "done" ? <Icon icon={Check} label="Done" /> : number}
    </span>
  );
}
