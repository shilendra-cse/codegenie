import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { Glow } from "@/components/atoms/glow";
import { APP_HOME, SIGN_IN } from "@/lib/routes";

export type ClosingCtaProps = { signedIn: boolean };

export function ClosingCta({ signedIn }: ClosingCtaProps) {
  return (
    <section className="relative isolate overflow-hidden border-t border-border bg-surface">
      <Glow className="top-1/2 h-[360px] -translate-y-1/2" />
      <div className="reveal mx-auto flex max-w-[1160px] flex-col items-center gap-5 px-6 py-24 text-center">
        <h2 className="text-[40px] font-semibold tracking-[-0.03em]">
          Hand off your next task
        </h2>
        <p className="text-base text-muted-foreground">
          Connect a repository in a minute. Review your first pull request soon
          after.
        </p>
        <Button
          asChild
          variant="primary"
          size="lg"
          className="shadow-[0_8px_24px_-8px_var(--glow)]"
        >
          {signedIn ? (
            <Link href={APP_HOME}>Open CodeGenie</Link>
          ) : (
            <Link href={SIGN_IN}>Sign in with GitHub</Link>
          )}
        </Button>
      </div>
    </section>
  );
}
