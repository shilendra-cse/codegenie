import Link from "next/link";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Button } from "@/components/atoms/button";
import { Logo } from "@/components/atoms/logo";
import { APP_HOME, PRICING, SIGN_IN } from "@/lib/routes";

export type SiteHeaderProps = {
  signedIn: boolean;
  /** The page it's on, when that's in the menu; the landing page's sections are linked from anywhere else. */
  current?: "pricing";
};

export function SiteHeader({ signedIn, current }: SiteHeaderProps) {
  const section = (id: string) => (current ? `/#${id}` : `#${id}`);
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 py-3.5">
        <Link href="/" aria-label={`${PRODUCT_NAME} home`}>
          <Logo />
        </Link>
        <nav aria-label="Main" className="ml-4 flex flex-1 gap-1">
          <Button asChild variant="ghost">
            <a href={section("how")}>How it works</a>
          </Button>
          <Button asChild variant="ghost">
            <a href={section("trust")}>Security</a>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="aria-[current=page]:text-foreground"
          >
            <Link
              href={PRICING}
              aria-current={current === "pricing" ? "page" : undefined}
            >
              Pricing
            </Link>
          </Button>
        </nav>
        {signedIn ? (
          <Button asChild variant="primary">
            <Link href={APP_HOME}>Open {PRODUCT_NAME}</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="ghost">
              <Link href={SIGN_IN}>Sign in</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href={SIGN_IN}>Get started</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
