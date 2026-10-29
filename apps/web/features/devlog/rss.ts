import { DEVLOG, DEVLOG_RSS, devlogPostPath } from "@/lib/routes";
import { DEVLOG_DESCRIPTION, DEVLOG_TITLE } from "./devlog";
import type { Post } from "./posts";

type FeedPost = Pick<Post, "slug" | "title" | "date" | "summary">;

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

const escapeXml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);

const rfc822 = (date: string) => new Date(`${date}T00:00:00Z`).toUTCString();

function item(post: FeedPost, siteUrl: string) {
  const url = `${siteUrl}${devlogPostPath(post.slug)}`;
  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(post.date)}</pubDate>
      <description>${escapeXml(post.summary)}</description>
    </item>`;
}

export function buildRss(posts: FeedPost[], siteUrl: string): string {
  const latest = posts[0];
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(DEVLOG_TITLE)}</title>`,
    `    <link>${siteUrl}${DEVLOG}</link>`,
    `    <atom:link href="${siteUrl}${DEVLOG_RSS}" rel="self" type="application/rss+xml"/>`,
    `    <description>${escapeXml(DEVLOG_DESCRIPTION)}</description>`,
    "    <language>en</language>",
    ...(latest
      ? [`    <lastBuildDate>${rfc822(latest.date)}</lastBuildDate>`]
      : []),
    ...posts.map((post) => item(post, siteUrl)),
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
