import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { TopBar } from "@/components/organisms/top-bar";

export type ProjectTab = {
  label: string;
  href: string;
  active: boolean;
  attention?: boolean;
};

export type ProjectTabsProps = {
  name: string;
  fullName: string;
  repositoryUrl: string;
  newTaskHref: string;
  tabs: ProjectTab[];
  banner?: ReactNode;
  children: ReactNode;
};

export function ProjectTabs({
  name,
  fullName,
  repositoryUrl,
  newTaskHref,
  tabs,
  banner,
  children,
}: ProjectTabsProps) {
  return (
    <>
      <div className="sticky top-0 z-20 bg-background">
        <TopBar title={name}>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[13px] text-faint hover:text-foreground"
          >
            {fullName}
            <Icon icon={ArrowUpRight} size={14} />
          </a>
          <span className="flex-1" />
          <Button asChild size="sm" variant="primary" glow>
            <Link href={newTaskHref}>
              <Icon icon={Plus} size={14} />
              New task
            </Link>
          </Button>
        </TopBar>
        <nav
          aria-label="Project"
          className="flex gap-1 border-b border-border bg-background px-6"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              aria-label={
                tab.attention ? `${tab.label}, needs attention` : undefined
              }
              className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2.5 font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary aria-[current=page]:border-foreground aria-[current=page]:text-foreground"
            >
              {tab.label}
              {tab.attention && (
                <span aria-hidden className="size-2 rounded-full bg-warn" />
              )}
            </Link>
          ))}
        </nav>
      </div>
      {banner}
      {children}
    </>
  );
}
