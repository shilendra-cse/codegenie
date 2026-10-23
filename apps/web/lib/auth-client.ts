import { createAuthClient } from "better-auth/react";
import { safeNext } from "./safe-next";

export const authClient = createAuthClient();

export function signInWithGitHub(next?: string | null) {
  return authClient.signIn.social({
    provider: "github",
    callbackURL: safeNext(next),
  });
}

export const { signOut, useSession } = authClient;
