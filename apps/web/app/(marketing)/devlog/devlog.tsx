import { Rss } from "lucide-react";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Glow } from "@/components/atoms/glow";
import { GridBackdrop } from "@/components/atoms/grid-backdrop";
import { Icon } from "@/components/atoms/icon";
import { DevlogLatestCard } from "@/components/organisms/devlog-latest-card";
import {
  type DevlogPostLink,
  DevlogPostList,
} from "@/components/organisms/devlog-post-list";
import { SiteFooter } from "@/components/organisms/site-footer";
import { MarketingLayout } from "@/components/templates/marketing-layout";
import { DEVLOG_DESCRIPTION } from "@/features/devlog/devlog";
import { DEVLOG_RSS } from "@/lib/routes";
import { DevlogHeader } from "./session";

export function Devlog({ posts }: { posts: DevlogPostLink[] }) {
  const [latest, ...earlier] = posts;
  return (
    <MarketingLayout header={<DevlogHeader />} footer={<SiteFooter />}>
      <div className="relative isolate">
        <GridBackdrop />
        <Glow className="top-[200px] h-[360px]" />
        <section className="mx-auto flex max-w-[1160px] flex-col items-center gap-4 px-6 pt-[88px] pb-12 text-center">
          <Badge className="bg-card">Devlog</Badge>
          <h1 className="max-w-[760px] text-[52px] leading-[1.08] font-semibold tracking-[-0.035em]">
            Building {PRODUCT_NAME}
          </h1>
          <p className="max-w-[560px] text-[17px] text-muted-foreground">
            {DEVLOG_DESCRIPTION}
          </p>
          <Button asChild variant="ghost" size="sm">
            <a href={DEVLOG_RSS}>
              <Icon icon={Rss} size={14} />
              Follow with RSS
            </a>
          </Button>
        </section>
        {latest && <DevlogLatestCard post={latest} />}
      </div>
      {earlier.length > 0 && <DevlogPostList posts={earlier} />}
      {!latest && (
        <section className="mx-auto max-w-[880px] px-6 pb-30">
          <div className="flex flex-col items-center gap-2 rounded-[14px] border border-border bg-surface px-8 py-12 text-center">
            <h2 className="text-base font-semibold">No posts yet</h2>
            <p className="max-w-[400px] text-muted-foreground">
              The first one is on its way. Follow with RSS to get it when it
              lands.
            </p>
          </div>
        </section>
      )}
    </MarketingLayout>
  );
}
