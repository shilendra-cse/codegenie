"use client";

import { useAccount } from "@/features/account/use-account";

export default function WelcomePage() {
  const { account } = useAccount();
  const firstName = account?.name.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2 px-6 py-[72px]">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
        {firstName ? `Welcome, ${firstName}` : "Welcome"}
      </h1>
      <p className="text-[15px] text-muted-foreground">
        A few steps and CodeGenie is ready to work on your code.
      </p>
    </div>
  );
}
