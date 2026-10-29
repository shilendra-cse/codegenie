import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GridBackdrop } from "@/components/atoms/grid-backdrop";
import { Icon } from "@/components/atoms/icon";
import { DevlogDate } from "@/components/molecules/devlog-date";
import { DevlogCta } from "@/components/organisms/devlog-cta";
import {
  DevlogPostPager,
  type DevlogPostPagerProps,
} from "@/components/organisms/devlog-post-pager";
import { SiteFooter } from "@/components/organisms/site-footer";
import { MarketingLayout } from "@/components/templates/marketing-layout";
import { DEVLOG } from "@/lib/routes";
import { DevlogHeader, SignedOutOnly } from "../session";

export type DevlogPostProps = {
  post: { title: string; date: string; summary: string; author: string };
  previous: DevlogPostPagerProps["previous"];
  children: ReactNode;
};

export function DevlogPost({ post, previous, children }: DevlogPostProps) {
  return (
    <MarketingLayout header={<DevlogHeader />} footer={<SiteFooter />}>
      <article>
        <header className="relative isolate">
          <GridBackdrop />
          <div className="mx-auto flex max-w-[720px] flex-col gap-[18px] px-6 pt-14 pb-9">
            <Link
              href={DEVLOG}
              className="inline-flex min-h-8 items-center gap-1.5 self-start text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Icon icon={ArrowLeft} size={14} />
              Devlog
            </Link>
            <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-faint">
              <DevlogDate date={post.date} />
              <span aria-hidden>·</span>
              <span>{post.author}</span>
            </div>
            <h1 className="text-[44px] leading-[1.1] font-semibold tracking-[-0.035em]">
              {post.title}
            </h1>
            <p className="text-lg leading-[1.6] text-muted-foreground">
              {post.summary}
            </p>
          </div>
        </header>
        <div className="mx-auto max-w-[720px] px-6 pt-2">{children}</div>
        <footer className="mx-auto flex max-w-[720px] flex-col gap-10 px-6 pt-8 pb-24">
          <SignedOutOnly>
            <DevlogCta />
          </SignedOutOnly>
          <DevlogPostPager previous={previous} />
        </footer>
      </article>
    </MarketingLayout>
  );
}
