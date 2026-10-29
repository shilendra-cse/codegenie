// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildRss } from "./rss";

const SITE = "https://hobai.app";

const posts = [
  {
    slug: "hobai-is-live",
    title: "hobai is live",
    date: "2026-11-02",
    summary: "Describe a task, get a pull request.",
  },
  {
    slug: "plans-and-usage-limits",
    title: "Plans & limits <for now>",
    date: "2026-10-26",
    summary: `Runs that fail on "our" side don't count.`,
  },
];

const parse = (xml: string) => new DOMParser().parseFromString(xml, "text/xml");

describe("buildRss", () => {
  it("is valid XML describing the devlog", () => {
    const doc = parse(buildRss(posts, SITE));

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector("channel > title")?.textContent).toBe(
      "hobai devlog",
    );
    expect(doc.querySelector("channel > link")?.textContent).toBe(
      "https://hobai.app/devlog",
    );
    expect(doc.querySelector("channel > lastBuildDate")?.textContent).toBe(
      "Mon, 02 Nov 2026 00:00:00 GMT",
    );
  });

  it("lists every post in order, with absolute links and RFC 822 dates", () => {
    const items = [...parse(buildRss(posts, SITE)).querySelectorAll("item")];

    expect(items.map((i) => i.querySelector("link")?.textContent)).toEqual([
      "https://hobai.app/devlog/hobai-is-live",
      "https://hobai.app/devlog/plans-and-usage-limits",
    ]);
    expect(items[1]?.querySelector("guid")?.textContent).toBe(
      "https://hobai.app/devlog/plans-and-usage-limits",
    );
    expect(items[1]?.querySelector("pubDate")?.textContent).toBe(
      "Mon, 26 Oct 2026 00:00:00 GMT",
    );
  });

  it("escapes titles and summaries", () => {
    const xml = buildRss(posts, SITE);
    const second = parse(xml).querySelectorAll("item")[1];

    expect(xml).toContain("Plans &amp; limits &lt;for now&gt;");
    expect(second?.querySelector("title")?.textContent).toBe(
      "Plans & limits <for now>",
    );
    expect(second?.querySelector("description")?.textContent).toBe(
      `Runs that fail on "our" side don't count.`,
    );
  });

  it("is still a valid feed with no posts", () => {
    const doc = parse(buildRss([], SITE));

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelectorAll("item")).toHaveLength(0);
  });
});
