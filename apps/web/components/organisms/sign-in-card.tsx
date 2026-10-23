import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { GitHubMark } from "@/components/atoms/github-mark";
import { Logo } from "@/components/atoms/logo";

export type SignInCardProps = {
  busy: boolean;
  error: boolean;
  onSignIn: () => void;
};

export function SignInCard({ busy, error, onSignIn }: SignInCardProps) {
  return (
    <section
      aria-labelledby="sign-in-title"
      className="flex w-full max-w-[400px] flex-col items-center gap-5 rounded-lg border border-border bg-card px-8 py-10 text-center shadow-card"
    >
      <Logo variant="mark" className="h-[30px] w-10" />
      <div className="flex flex-col gap-1.5">
        <h1
          id="sign-in-title"
          className="text-[22px] font-semibold tracking-[-0.015em]"
        >
          Sign in to CodeGenie
        </h1>
        <p className="text-muted-foreground">
          Use your GitHub account. New here? This creates your account.
        </p>
      </div>
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        busy={busy}
        onClick={onSignIn}
      >
        {!busy && <GitHubMark />}
        Continue with GitHub
      </Button>
      <p className="text-[13px] leading-normal text-faint">
        Signing in only shares your name and email. You give access to
        repositories separately, one by one, when you install the GitHub App.
      </p>
      {error && (
        <Alert tone="error" className="w-full">
          GitHub didn&apos;t complete the sign-in. Try again.
        </Alert>
      )}
    </section>
  );
}
