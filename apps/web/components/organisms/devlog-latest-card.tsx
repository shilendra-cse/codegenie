import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/atoms/badge";
import { Icon } from "@/components/atoms/icon";
import { DevlogDate } from "@/components/molecules/devlog-date";
import { devlogPostPath } from "@/lib/routes";
import type { DevlogPostLink } from "./devlog-post-list";

export function DevlogLatestCard({ post }: { post: DevlogPostLink }) {
  return (
    <div className="mx-auto max-w-[880px] px-6 pb-12">
      <div className="beam">
        <Link
          href={devlogPostPath(post.slug)}
          className="group flex flex-col gap-3.5 rounded-[13px] bg-card p-8"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge className="bg-card">Latest</Badge>
            <DevlogDate date={post.date} />
          </div>
          <h2 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em]">
            {post.title}
          </h2>
          <p className="max-w-[640px] text-base text-muted-foreground">
            {post.summary}
          </p>
          <span className="inline-flex min-h-8 items-center gap-1.5 text-[13px] font-medium">
            Read post
            <Icon
              icon={ArrowRight}
              size={14}
              className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
            />
          </span>
        </Link>
      </div>
    </div>
  );
}
