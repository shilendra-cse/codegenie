import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { APP_HOME, SIGN_IN } from "@/lib/routes";

export type ClosingCtaProps = { signedIn: boolean };

export function ClosingCta({ signedIn }: ClosingCtaProps) {
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-5 px-6 py-20 text-center">
        <h2 className="text-[32px] font-semibold tracking-[-0.025em]">
          Hand off your next task
        </h2>
        <Button asChild variant="primary" size="lg">
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
