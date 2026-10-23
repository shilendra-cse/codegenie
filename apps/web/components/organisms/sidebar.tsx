import { Inbox, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Logo } from "@/components/atoms/logo";
import { NavItem } from "@/components/molecules/nav-item";
import { APP_HOME, INBOX } from "@/lib/routes";

export type SidebarProps = {
  pathname: string;
  account: ReactNode;
};

export function Sidebar({ pathname, account }: SidebarProps) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 p-3">
      <Link
        href={APP_HOME}
        aria-label="CodeGenie home"
        className="self-start px-2.5 pt-1.5 pb-3.5"
      >
        <Logo />
      </Link>
      <Button
        variant="primary"
        disabled
        title="Coming soon"
        className="w-full justify-start"
      >
        <Icon icon={Plus} />
        New task
      </Button>
      <nav aria-label="Main" className="mt-2 flex flex-col gap-0.5">
        <NavItem href={INBOX} icon={Inbox} active={pathname.startsWith(INBOX)}>
          Inbox
        </NavItem>
      </nav>
      <h2 className="px-2.5 pt-[18px] pb-1.5 text-xs font-medium text-faint">
        Projects
      </h2>
      <p className="px-2.5 py-1 text-[13px] text-faint">No projects yet.</p>
      <div className="flex-1" />
      <div className="mt-3">{account}</div>
    </div>
  );
}
