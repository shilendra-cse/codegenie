import type { MDXComponents } from "next-mdx-remote-client/rsc";
import { z } from "zod";
import { Figure } from "@/components/molecules/figure";
import { devlogAssetUrl } from "@/features/devlog/assets";

const figureProps = z.strictObject({
  src: z.string(),
  darkSrc: z.string().optional(),
  alt: z.string().trim().min(1),
  caption: z.string().optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

function checked<T>(
  slug: string,
  tag: string,
  schema: z.ZodType<T>,
  props: unknown,
) {
  const result = schema.safeParse(props);
  if (!result.success) {
    throw new Error(`${slug}.mdx: <${tag}>:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function postComponents(slug: string): MDXComponents {
  return {
    Figure(props: unknown) {
      const { src, darkSrc, ...rest } = checked(
        slug,
        "Figure",
        figureProps,
        props,
      );
      return (
        <Figure
          {...rest}
          src={devlogAssetUrl(slug, src)}
          darkSrc={darkSrc && devlogAssetUrl(slug, darkSrc)}
        />
      );
    },
  };
}
