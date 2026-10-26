"use client";

import { Badge } from "@/components/atoms/badge";
import { Glow } from "@/components/atoms/glow";
import { GridBackdrop } from "@/components/atoms/grid-backdrop";
import { PlanCards } from "@/components/organisms/plan-cards";
import { PricingQuestions } from "@/components/organisms/pricing-questions";
import { SiteFooter } from "@/components/organisms/site-footer";
import { SiteHeader } from "@/components/organisms/site-header";
import { MarketingLayout } from "@/components/templates/marketing-layout";
import { useSession } from "@/lib/auth-client";

export function Pricing() {
  const signedIn = Boolean(useSession().data);
  return (
    <MarketingLayout
      header={<SiteHeader signedIn={signedIn} current="pricing" />}
      footer={<SiteFooter />}
    >
      <div className="relative isolate">
        <GridBackdrop />
        <Glow className="top-[260px] h-[420px]" />
        <section className="mx-auto flex max-w-[1160px] flex-col items-center gap-4 px-6 pt-[88px] pb-10 text-center">
          <Badge className="bg-card">Pricing</Badge>
          <h1 className="max-w-[760px] text-[52px] leading-[1.08] font-semibold tracking-[-0.035em]">
            Simple pricing
          </h1>
          <p className="max-w-[560px] text-[17px] text-muted-foreground">
            Every run happens in its own sandbox and ends in a pull request on
            your repository.
          </p>
        </section>
        <PlanCards signedIn={signedIn} />
      </div>
      <PricingQuestions />
    </MarketingLayout>
  );
}
