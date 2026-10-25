import type { ComponentProps } from "react";
import {
  DialogClose as FactoryDialogClose,
  DialogContent as FactoryDialogContent,
  DialogDescription as FactoryDialogDescription,
  Dialog as FactoryDialog,
  DialogTitle as FactoryDialogTitle,
} from "@/components/factory/dialog";
import { cn } from "@/lib/utils";

export const Dialog = FactoryDialog;
export const DialogClose = FactoryDialogClose;

export function DialogContent({
  className,
  ...props
}: Omit<ComponentProps<typeof FactoryDialogContent>, "showCloseButton">) {
  return (
    <FactoryDialogContent
      showCloseButton={false}
      className={cn(
        "top-[120px] flex max-w-[min(440px,calc(100%-2rem))] translate-y-0 flex-col gap-3 rounded-lg border-border bg-card p-5 text-sm shadow-card sm:max-w-[440px]",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof FactoryDialogTitle>) {
  return (
    <FactoryDialogTitle
      className={cn("text-base leading-normal font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof FactoryDialogDescription>) {
  return (
    <FactoryDialogDescription
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
