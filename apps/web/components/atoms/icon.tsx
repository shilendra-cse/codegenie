import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IconProps = {
  icon: LucideIcon;
  size?: 14 | 16 | 20;
  label?: string;
  className?: string;
};

export function Icon({ icon: Glyph, size = 16, label, className }: IconProps) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      className={cn("shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
