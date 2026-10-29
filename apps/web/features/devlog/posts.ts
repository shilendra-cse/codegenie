import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { parse } from "yaml";
import { z } from "zod";
import { type PostHeader, postHeaderSchema } from "./post-schema";

export type Post = PostHeader & { slug: string; body: string };

const CONTENT_DIR = path.join(process.cwd(), "content/devlog");
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

function readHeader(fileName: string, yaml: string): unknown {
  try {
    // The core schema keeps dates as strings; YAML 1.1 would turn 2026-02-30 into March 2.
    return parse(yaml, { schema: "core" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${fileName}: the header isn't valid YAML: ${reason}`, {
      cause: error,
    });
  }
}

export function parsePost(fileName: string, source: string): Post {
  const slug = path.basename(fileName, ".mdx");
  if (!SLUG.test(slug)) {
    throw new Error(
      `${fileName}: the file name must be lowercase words joined by "-"`,
    );
  }
  const match = FRONTMATTER.exec(source);
  if (!match) {
    throw new Error(`${fileName}: the post must start with a --- header`);
  }
  const header = postHeaderSchema.safeParse(readHeader(fileName, match[1]));
  if (!header.success) {
    throw new Error(`${fileName}:\n${z.prettifyError(header.error)}`);
  }
  return { ...header.data, slug, body: source.slice(match[0].length) };
}

const newestFirst = (a: Post, b: Post) =>
  b.date.localeCompare(a.date) || a.title.localeCompare(b.title);

export async function loadPosts(
  dir: string,
  { includeDrafts }: { includeDrafts: boolean },
): Promise<Post[]> {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".mdx"));
  const posts = await Promise.all(
    files.map(async (file) =>
      parsePost(file, await readFile(path.join(dir, file), "utf8")),
    ),
  );
  return posts.filter((post) => includeDrafts || !post.draft).sort(newestFirst);
}

export const getPosts = cache(() =>
  loadPosts(CONTENT_DIR, {
    includeDrafts: process.env.NODE_ENV !== "production",
  }),
);

export const getPost = cache(
  async (slug: string) =>
    (await getPosts()).find((post) => post.slug === slug) ?? null,
);
