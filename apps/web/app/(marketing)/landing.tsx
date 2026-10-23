"use client";

import { ClosingCta } from "@/components/organisms/closing-cta";
import { Hero } from "@/components/organisms/hero";
import { HowItWorks } from "@/components/organisms/how-it-works";
import { ProductPreview } from "@/components/organisms/product-preview";
import { SecurityPoints } from "@/components/organisms/security-points";
import { SiteFooter } from "@/components/organisms/site-footer";
import { SiteHeader } from "@/components/organisms/site-header";
import { MarketingLayout } from "@/components/templates/marketing-layout";
import { useSession } from "@/lib/auth-client";

export function Landing() {
  const signedIn = Boolean(useSession().data);
  return (
    <MarketingLayout
      header={<SiteHeader signedIn={signedIn} />}
      footer={<SiteFooter />}
    >
      <Hero signedIn={signedIn} />
      <ProductPreview />
      <HowItWorks />
      <SecurityPoints />
      <ClosingCta signedIn={signedIn} />
    </MarketingLayout>
  );
}
