import type { ComponentProps } from "react";
import {
  Command as FactoryCommand,
  CommandEmpty as FactoryCommandEmpty,
  CommandInput as FactoryCommandInput,
  CommandItem as FactoryCommandItem,
  CommandList as FactoryCommandList,
} from "@/components/factory/command";
import { cn } from "@/lib/utils";

export function Command({
  className,
  ...props
}: ComponentProps<typeof FactoryCommand>) {
  return (
    <FactoryCommand
      className={cn("bg-card text-foreground", className)}
      {...props}
    />
  );
}

export function CommandInput(
  props: ComponentProps<typeof FactoryCommandInput>,
) {
  return <FactoryCommandInput className="placeholder:text-faint" {...props} />;
}

export function CommandList({
  className,
  ...props
}: ComponentProps<typeof FactoryCommandList>) {
  return (
    <FactoryCommandList
      className={cn("max-h-[248px] p-1.5", className)}
      {...props}
    />
  );
}

export function CommandEmpty(
  props: ComponentProps<typeof FactoryCommandEmpty>,
) {
  return <FactoryCommandEmpty {...props} />;
}

export function CommandItem({
  className,
  ...props
}: ComponentProps<typeof FactoryCommandItem>) {
  return (
    <FactoryCommandItem
      className={cn(
        "gap-2.5 px-2.5 py-2 data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}
