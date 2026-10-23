import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Input as FactoryInput } from "@/components/factory/input";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

export type InputProps = ComponentProps<"input"> & { icon?: LucideIcon };

export function Input({ icon, className, ...props }: InputProps) {
  const input = (
    <FactoryInput
      className={cn(
        "h-9 rounded-md border-border bg-card text-sm shadow-none placeholder:text-faint focus-visible:border-border focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary dark:bg-card",
        icon && "pl-9",
        className,
      )}
      {...props}
    />
  );
  if (!icon) return input;
  return (
    <div className="relative">
      <Icon
        icon={icon}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
      />
      {input}
    </div>
  );
}
