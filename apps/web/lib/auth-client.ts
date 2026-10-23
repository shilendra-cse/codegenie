import { createAuthClient } from "better-auth/react";
import { SIGN_IN } from "./routes";
import { safeNext } from "./safe-next";

export const authClient = createAuthClient();

export function signInWithGitHub(next?: string | null) {
  return authClient.signIn.social({
    provider: "github",
    callbackURL: safeNext(next),
    errorCallbackURL: SIGN_IN,
  });
}

export const { signOut, useSession } = authClient;
