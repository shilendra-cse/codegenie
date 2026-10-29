import { type MDXComponents, evaluate } from "next-mdx-remote-client/rsc";
import type { ComponentProps } from "react";
import rehypePrettyCode, {
  type Options as PrettyCodeOptions,
} from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

const prettyCode: PrettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  keepBackground: false,
  defaultLang: { block: "plaintext" },
};

function Table(props: ComponentProps<"table">) {
  return (
    <div className="devlog-table">
      <table {...props} />
    </div>
  );
}

export type DevlogProseProps = {
  source: string;
  components?: MDXComponents;
};

export async function DevlogProse({ source, components }: DevlogProseProps) {
  const { content, error } = await evaluate({
    source,
    components: { table: Table, ...components },
    options: {
      disableImports: true,
      disableExports: true,
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, [rehypePrettyCode, prettyCode]],
      },
    },
  });
  if (error) throw error;
  return <div className="devlog-prose">{content}</div>;
}
