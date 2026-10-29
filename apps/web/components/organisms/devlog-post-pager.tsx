import Link from "next/link";
import { DEVLOG, devlogPostPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const linkClass =
  "flex flex-col gap-1 rounded-lg border border-border px-[18px] py-4 transition-colors hover:border-border-strong hover:bg-muted motion-reduce:transition-none";

export type DevlogPostPagerProps = {
  previous: { slug: string; title: string } | null;
};

export function DevlogPostPager({ previous }: DevlogPostPagerProps) {
  return (
    <nav
      aria-label="More posts"
      className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3"
    >
      {previous && (
        <Link href={devlogPostPath(previous.slug)} className={linkClass}>
          <span className="text-xs text-faint">Previous</span>
          <span className="font-medium">{previous.title}</span>
        </Link>
      )}
      <Link href={DEVLOG} className={cn(linkClass, "text-right")}>
        <span className="text-xs text-faint">All posts</span>
        <span className="font-medium">Back to the devlog</span>
      </Link>
    </nav>
  );
}
