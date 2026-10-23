import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
};

export function Spinner({ size = 16, label, className }: SpinnerProps) {
  return (
    <Loader2
      size={size}
      strokeWidth={1.75}
      className={cn(
        "shrink-0 animate-spin motion-reduce:animate-none",
        className,
      )}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
