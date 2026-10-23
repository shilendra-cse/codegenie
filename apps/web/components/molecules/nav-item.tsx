import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/icon";

export type NavItemProps = {
  href: string;
  icon: LucideIcon;
  active?: boolean;
  children: ReactNode;
};

export function NavItem({ href, icon, active, children }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex min-h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
    >
      <Icon icon={icon} />
      {children}
    </Link>
  );
}
