import { Rss } from "lucide-react";
import Link from "next/link";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Icon } from "@/components/atoms/icon";
import { Logo } from "@/components/atoms/logo";
import { DEVLOG, DEVLOG_RSS } from "@/lib/routes";

const linkClass =
  "inline-flex min-h-8 items-center gap-1.5 text-[13px] text-faint hover:text-foreground";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 py-6">
        <Logo variant="mark" />
        <span className="text-[13px] text-faint">
          © {new Date().getFullYear()} {PRODUCT_NAME}
        </span>
        <span className="flex-1" />
        <Link href={DEVLOG} className={linkClass}>
          Devlog
        </Link>
        <a href={DEVLOG_RSS} className={linkClass}>
          <Icon icon={Rss} size={14} />
          RSS
        </a>
      </div>
    </footer>
  );
}
