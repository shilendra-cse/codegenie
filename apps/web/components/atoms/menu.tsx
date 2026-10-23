import type { ComponentProps } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/factory/dropdown-menu";
import { cn } from "@/lib/utils";

export const Menu = DropdownMenu;
export const MenuTrigger = DropdownMenuTrigger;
export const MenuRadioGroup = DropdownMenuRadioGroup;

export function MenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      className={cn(
        "min-w-[220px] rounded-md border-border bg-card p-1.5 shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function MenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      className={cn(
        "gap-2.5 rounded-sm px-2.5 py-2 text-sm focus:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function MenuRadioItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuRadioItem>) {
  return (
    <DropdownMenuRadioItem
      className={cn(
        "gap-2.5 rounded-sm py-2 pr-2.5 text-sm focus:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      className={cn("px-2.5 py-1.5 text-xs font-medium text-faint", className)}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      className={cn("-mx-1.5 my-1.5 bg-border", className)}
      {...props}
    />
  );
}
