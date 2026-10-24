import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/icon";

export type NavItemProps = {
  href: string;
  active?: boolean;
  /** Replaces the text as the link's name, when the visible text needs context. */
  label?: string;
  /** Shown at the end of the row, e.g. "Needs you". */
  trailing?: ReactNode;
  children: ReactNode;
} & (
  | { icon: LucideIcon; leading?: never }
  | { leading: ReactNode; icon?: never }
);

export function NavItem({
  href,
  icon,
  leading,
  active,
  label,
  trailing,
  children,
}: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className="flex min-h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
    >
      {icon ? <Icon icon={icon} /> : leading}
      <span className="min-w-0 truncate">{children}</span>
      {trailing && <span className="ml-auto shrink-0">{trailing}</span>}
    </Link>
  );
}
