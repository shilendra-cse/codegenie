import Link from "next/link";
import { DevlogDate } from "@/components/molecules/devlog-date";
import { devlogPostPath } from "@/lib/routes";

export type DevlogPostLink = {
  slug: string;
  title: string;
  date: string;
  summary: string;
};

export function DevlogPostList({ posts }: { posts: DevlogPostLink[] }) {
  return (
    <section
      aria-labelledby="earlier"
      className="mx-auto max-w-[880px] px-6 pt-6 pb-24"
    >
      <h2
        id="earlier"
        className="mb-2 text-[13px] font-medium tracking-[0.02em] text-faint"
      >
        Earlier
      </h2>
      <ul className="border-b border-border">
        {posts.map((post) => (
          <li key={post.slug}>
            <article className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border py-7">
              <DevlogDate date={post.date} className="basis-[140px] pt-[3px]" />
              <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-2">
                <h3 className="text-xl leading-[1.3] font-semibold tracking-[-0.015em]">
                  <Link
                    href={devlogPostPath(post.slug)}
                    className="decoration-border-strong underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                </h3>
                <p className="max-w-[620px] text-[15px] text-muted-foreground">
                  {post.summary}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
