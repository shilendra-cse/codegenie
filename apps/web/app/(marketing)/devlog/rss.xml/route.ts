import { getPosts } from "@/features/devlog/posts";
import { buildRss } from "@/features/devlog/rss";
import { SITE_URL } from "@/lib/routes";

export const dynamic = "force-static";

export async function GET() {
  return new Response(buildRss(await getPosts(), SITE_URL), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
