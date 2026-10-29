import { evaluate } from "next-mdx-remote-client/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

export async function DevlogProse({ source }: { source: string }) {
  const { content, error } = await evaluate({
    source,
    options: {
      disableImports: true,
      disableExports: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug],
      },
    },
  });
  if (error) throw error;
  return <div className="devlog-prose">{content}</div>;
}
