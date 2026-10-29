"use client";

import type { ReactNode } from "react";
import { SiteHeader } from "@/components/organisms/site-header";
import { useSession } from "@/lib/auth-client";

export function DevlogHeader() {
  return <SiteHeader signedIn={Boolean(useSession().data)} current="devlog" />;
}

export function SignedOutOnly({ children }: { children: ReactNode }) {
  return useSession().data ? null : children;
}
