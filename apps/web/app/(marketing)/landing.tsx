"use client";

import { Glow } from "@/components/atoms/glow";
import { GridBackdrop } from "@/components/atoms/grid-backdrop";
import { ClosingCta } from "@/components/organisms/closing-cta";
import { Hero } from "@/components/organisms/hero";
import { HowItWorks } from "@/components/organisms/how-it-works";
import { ProductPreview } from "@/components/organisms/product-preview";
import { SecurityPoints } from "@/components/organisms/security-points";
import { SiteFooter } from "@/components/organisms/site-footer";
import { SiteHeader } from "@/components/organisms/site-header";
import { ToolRow } from "@/components/organisms/tool-row";
import { MarketingLayout } from "@/components/templates/marketing-layout";
import { useSession } from "@/lib/auth-client";

export function Landing() {
  const signedIn = Boolean(useSession().data);
  return (
    <MarketingLayout
      header={<SiteHeader signedIn={signedIn} />}
      footer={<SiteFooter />}
    >
      <div className="relative isolate">
        <GridBackdrop />
        <Glow className="top-[420px] h-[520px]" />
        <Hero signedIn={signedIn} />
        <ProductPreview />
        <ToolRow />
      </div>
      <HowItWorks />
      <SecurityPoints />
      <ClosingCta signedIn={signedIn} />
    </MarketingLayout>
  );
}
