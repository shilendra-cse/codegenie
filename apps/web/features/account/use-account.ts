import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut as endSession, useSession } from "@/lib/auth-client";

export type Account = { name: string; email: string; image: string | null };

export function useAccount() {
  const session = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const user = session.data?.user;

  const account: Account | null = user
    ? {
        name: user.name || user.email,
        email: user.email,
        image: user.image ?? null,
      }
    : null;

  const signOut = async () => {
    setSigningOut(true);
    await endSession();
    queryClient.clear();
    router.replace("/");
  };

  return { account, pending: session.isPending, signingOut, signOut };
}
