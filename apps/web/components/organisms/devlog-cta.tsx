import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { FREE_PLAN } from "@/lib/plans";
import { SIGN_IN } from "@/lib/routes";

export function DevlogCta() {
  return (
    <section
      aria-labelledby="devlog-cta"
      className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[14px] border border-border bg-surface p-7"
    >
      <div className="flex flex-[1_1_280px] flex-col gap-1">
        <h2 id="devlog-cta" className="text-[17px] font-semibold">
          Try it on one of your repos
        </h2>
        <p className="text-muted-foreground">
          {FREE_PLAN.runsPerCycle} runs a month, free. No card needed.
        </p>
      </div>
      <Button asChild variant="primary" size="lg" glow>
        <Link href={SIGN_IN}>Start free</Link>
      </Button>
    </section>
  );
}
