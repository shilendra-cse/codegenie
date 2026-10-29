import type { Metadata } from "next";
import { DEVLOG_DESCRIPTION, DEVLOG_TITLE } from "@/features/devlog/devlog";
import { getPosts } from "@/features/devlog/posts";
import { DEVLOG, DEVLOG_RSS } from "@/lib/routes";
import { Devlog } from "./devlog";

export const metadata: Metadata = {
  title: DEVLOG_TITLE,
  description: DEVLOG_DESCRIPTION,
  alternates: {
    canonical: DEVLOG,
    types: { "application/rss+xml": DEVLOG_RSS },
  },
  openGraph: {
    type: "website",
    title: DEVLOG_TITLE,
    description: DEVLOG_DESCRIPTION,
    url: DEVLOG,
  },
};

export default async function DevlogPage() {
  return <Devlog posts={await getPosts()} />;
}
