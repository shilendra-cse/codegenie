import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/icon";

export type TopBarProps = {
  title: string;
  /** The page this one belongs to, shown before the title. */
  parent?: { label: string; href: string };
  children?: ReactNode;
};

export function TopBar({ title, parent, children }: TopBarProps) {
  return (
    <header className="relative z-10 flex min-h-[52px] flex-wrap items-center gap-2.5 border-b border-border bg-background px-6 py-2">
      {parent && (
        <>
          <Link
            href={parent.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {parent.label}
          </Link>
          <Icon icon={ChevronRight} size={14} className="text-faint" />
        </>
      )}
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </header>
  );
}
