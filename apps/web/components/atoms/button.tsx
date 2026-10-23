import type { ComponentProps } from "react";
import { Button as FactoryButton } from "@/components/factory/button";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const variants = {
  primary:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border-border bg-card text-foreground hover:bg-muted",
  ghost:
    "border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground",
  danger: "border-err-border bg-card text-err hover:bg-err-soft",
} as const;

const sizes = {
  sm: "h-[30px] gap-1.5 rounded-sm px-2.5 text-[13px]",
  md: "h-9 gap-2 rounded-md px-3.5 text-sm",
  lg: "h-11 gap-2 rounded-md px-[18px] text-[15px]",
} as const;

export type ButtonProps = Omit<
  ComponentProps<typeof FactoryButton>,
  "variant" | "size"
> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  busy?: boolean;
  /** The soft glow for a page's one main action. */
  glow?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  busy = false,
  glow = false,
  asChild,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <FactoryButton
      asChild={asChild}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        "border font-medium focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
        variants[variant],
        sizes[size],
        glow && "shadow-[0_8px_24px_-8px_var(--glow)]",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {busy && <Spinner size={size === "sm" ? 14 : 16} />}
          {children}
        </>
      )}
    </FactoryButton>
  );
}
