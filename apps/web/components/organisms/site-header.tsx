import Link from "next/link";
import { Button } from "@/components/atoms/button";
import { Logo } from "@/components/atoms/logo";
import { APP_HOME, SIGN_IN } from "@/lib/routes";

export type SiteHeaderProps = { signedIn: boolean };

export function SiteHeader({ signedIn }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center gap-4 px-6 py-3.5">
        <Link href="/" aria-label="CodeGenie home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="ml-4 flex flex-1 gap-1">
          <Button asChild variant="ghost">
            <a href="#how">How it works</a>
          </Button>
          <Button asChild variant="ghost">
            <a href="#trust">Security</a>
          </Button>
        </nav>
        {signedIn ? (
          <Button asChild variant="primary">
            <Link href={APP_HOME}>Open CodeGenie</Link>
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
