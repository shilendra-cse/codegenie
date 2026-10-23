import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export type Health = "ok" | "attention" | "none";

export const HEALTH_LABELS: Record<Health, string> = {
  ok: "Ready",
  attention: "Needs attention",
  none: "Not set up",
};

export type HealthDotProps = { health: Health };

export function HealthDot({ health }: HealthDotProps) {
  if (health === "attention") {
    return (
      <Icon
        icon={TriangleAlert}
        size={14}
        label={HEALTH_LABELS.attention}
        className="text-warn"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={HEALTH_LABELS[health]}
      className="flex size-3.5 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          health === "ok" ? "bg-ok" : "bg-faint",
        )}
      />
    </span>
  );
}
