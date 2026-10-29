import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadPosts, parsePost } from "./posts";

const FIXTURES = path.join(import.meta.dirname, "__fixtures__/posts");

const post = (header: string, body = "Hello.") =>
  `---\n${header}\n---\n${body}`;

const valid = [
  "title: Watching a run live",
  "date: 2026-10-24",
  "summary: Every read, edit and command.",
].join("\n");

describe("parsePost", () => {
  it("reads the header, the slug and the body", () => {
    expect(parsePost("watching-a-run.mdx", post(valid, "# Hi\n"))).toEqual({
      slug: "watching-a-run",
      title: "Watching a run live",
      date: "2026-10-24",
      summary: "Every read, edit and command.",
      author: "Shilendra Singh",
      draft: false,
      body: "# Hi\n",
    });
  });

  it("keeps the optional fields", () => {
    const parsed = parsePost(
      "a.mdx",
      post(`${valid}\nauthor: A guest\ndraft: true\nimage: card.png`),
    );
    expect(parsed).toMatchObject({
      author: "A guest",
      draft: true,
      image: "card.png",
    });
  });

  it("reads Windows line endings", () => {
    const source = post(valid).replaceAll("\n", "\r\n");
    expect(parsePost("a.mdx", source).title).toBe("Watching a run live");
  });

  it.each([
    ["an uppercase letter", "Watching.mdx"],
    ["an underscore", "watching_a_run.mdx"],
    ["a double dash", "watching--a-run.mdx"],
  ])("rejects a file name with %s", (_, fileName) => {
    expect(() => parsePost(fileName, post(valid))).toThrow(
      `${fileName}: the file name must be lowercase words joined by "-"`,
    );
  });

  it("rejects a post without a header", () => {
    expect(() => parsePost("a.mdx", "Just text.")).toThrow(
      "a.mdx: the post must start with a --- header",
    );
  });

  it("rejects a header that isn't YAML", () => {
    expect(() => parsePost("a.mdx", post("title: [unclosed"))).toThrow(
      "a.mdx: the header isn't valid YAML",
    );
  });

  it.each([
    [
      "a missing title",
      valid.replace("title: Watching a run live\n", ""),
      "title",
    ],
    [
      "a date in another format",
      valid.replace("2026-10-24", "24/10/2026"),
      "YYYY-MM-DD",
    ],
    [
      "a date that doesn't exist",
      valid.replace("2026-10-24", "2026-02-30"),
      "not a real date",
    ],
    [
      "a summary over 200 characters",
      valid.replace("Every read, edit and command.", "x".repeat(201)),
      "summary",
    ],
    [
      "an image path outside the post's folder",
      `${valid}\nimage: ../other/card.png`,
      "assets folder",
    ],
    ["a field it doesn't know", `${valid}\ntags: [launch]`, "tags"],
  ])("rejects %s, naming the file and the field", (_, header, field) => {
    expect(() => parsePost("a.mdx", post(header))).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          new RegExp(`^a\\.mdx:[\\s\\S]*${field}`),
        ),
      }),
    );
  });
});

describe("loadPosts", () => {
  it("reads every post, newest first, same-day posts by title", async () => {
    const posts = await loadPosts(FIXTURES, { includeDrafts: false });
    expect(posts.map((p) => p.slug)).toEqual([
      "same-day-post",
      "newer-post",
      "older-post",
    ]);
  });

  it("includes drafts when asked", async () => {
    const posts = await loadPosts(FIXTURES, { includeDrafts: true });
    expect(posts[0]?.slug).toBe("unfinished-post");
    expect(posts).toHaveLength(4);
  });
});
