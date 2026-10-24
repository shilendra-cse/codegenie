import type { ComponentProps } from "react";
import {
  PopoverContent as FactoryPopoverContent,
  Popover as FactoryPopover,
  PopoverTrigger as FactoryPopoverTrigger,
} from "@/components/factory/popover";
import { cn } from "@/lib/utils";

export const Popover = FactoryPopover;
export const PopoverTrigger = FactoryPopoverTrigger;

export function PopoverContent({
  className,
  ...props
}: ComponentProps<typeof FactoryPopoverContent>) {
  return (
    <FactoryPopoverContent
      className={cn(
        "rounded-md border-border bg-card p-0 shadow-card",
        className,
      )}
      {...props}
    />
  );
}
