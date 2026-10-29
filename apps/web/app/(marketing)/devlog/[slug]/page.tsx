import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevlogProse } from "@/components/organisms/devlog-prose";
import { DEVLOG_TITLE } from "@/features/devlog/devlog";
import { getPost, getPosts } from "@/features/devlog/posts";
import { DEVLOG_RSS, devlogPostPath } from "@/lib/routes";
import { DevlogPost } from "./post";
import { postComponents } from "./post-components";

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPosts()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  const url = devlogPostPath(post.slug);
  return {
    title: `${post.title} · ${DEVLOG_TITLE}`,
    description: post.summary,
    authors: [{ name: post.author }],
    alternates: {
      canonical: url,
      types: { "application/rss+xml": DEVLOG_RSS },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url,
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
    },
  };
}

export default async function DevlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const posts = await getPosts();
  const previous = posts[posts.indexOf(post) + 1] ?? null;
  return (
    <DevlogPost post={post} previous={previous}>
      <DevlogProse source={post.body} components={postComponents(slug)} />
    </DevlogPost>
  );
}
