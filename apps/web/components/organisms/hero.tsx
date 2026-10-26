import { GitBranch } from "lucide-react";
import Link from "next/link";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { GitHubMark } from "@/components/atoms/github-mark";
import { Icon } from "@/components/atoms/icon";
import { FREE_PLAN } from "@/lib/plans";
import { APP_HOME, SIGN_IN } from "@/lib/routes";

export type HeroProps = { signedIn: boolean };

export function Hero({ signedIn }: HeroProps) {
  return (
    <section className="mx-auto flex max-w-[1160px] flex-col items-center gap-6 px-6 pt-24 pb-14 text-center">
      <Badge className="sheen bg-card">
        <Icon icon={GitBranch} size={14} />
        An autonomous coding agent for your GitHub repositories
      </Badge>
      <h1 className="max-w-[900px] text-[clamp(40px,6.4vw,74px)] leading-[1.02] font-semibold tracking-[-0.04em]">
        Describe the change.
        <br />
        <span className="text-muted-foreground">Review the pull request.</span>
      </h1>
      <p className="max-w-[620px] text-lg leading-relaxed text-muted-foreground">
        {PRODUCT_NAME} works in an isolated sandbox: it installs your
        repository, makes the change, runs your checks and opens a pull request
        for you to review.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <Button asChild variant="primary" size="lg" glow>
            <Link href={APP_HOME}>Open {PRODUCT_NAME}</Link>
          </Button>
        ) : (
          <Button asChild variant="primary" size="lg" glow>
            <Link href={SIGN_IN}>
              <GitHubMark />
              Start free with GitHub
            </Link>
          </Button>
        )}
        <Button asChild size="lg">
          <a href="#how">See how it works</a>
        </Button>
      </div>
      <div className="mt-1 flex flex-col items-center gap-1.5">
        {!signedIn && (
          <p className="text-xl font-semibold tracking-[-0.015em]">
            Free to start: {FREE_PLAN.runsPerCycle} runs every month
          </p>
        )}
        <p className="text-[13px] text-faint">
          {!signedIn && "No card needed. "}For JavaScript and TypeScript
          repositories on GitHub.
        </p>
      </div>
    </section>
  );
}
