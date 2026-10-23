"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInCard } from "@/components/organisms/sign-in-card";
import { CenteredLayout } from "@/components/templates/centered-layout";
import { signInWithGitHub, useSession } from "@/lib/auth-client";
import { safeNext } from "@/lib/safe-next";

export type SignInScreenProps = { next?: string; failed: boolean };

export function SignInScreen({ next, failed }: SignInScreenProps) {
  const router = useRouter();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failed);

  useEffect(() => {
    if (session.data) router.replace(safeNext(next));
  }, [session.data, next, router]);

  const signIn = () => {
    setBusy(true);
    setError(false);
    void signInWithGitHub(next).then(({ error: failure }) => {
      if (!failure) return;
      setBusy(false);
      setError(true);
    });
  };

  return (
    <CenteredLayout>
      <SignInCard busy={busy} error={error} onSignIn={signIn} />
    </CenteredLayout>
  );
}
