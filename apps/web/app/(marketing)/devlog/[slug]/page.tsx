import { notFound } from "next/navigation";
import { DevlogProse } from "@/components/organisms/devlog-prose";
import { getPost, getPosts } from "@/features/devlog/posts";
import { DevlogPost } from "./post";

type Params = Promise<{ slug: string }>;

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPosts()).map(({ slug }) => ({ slug }));
}

export default async function DevlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const posts = await getPosts();
  const previous = posts[posts.indexOf(post) + 1] ?? null;
  return (
    <DevlogPost post={post} previous={previous}>
      <DevlogProse source={post.body} />
    </DevlogPost>
  );
}
