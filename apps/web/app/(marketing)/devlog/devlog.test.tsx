import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Devlog } from "./devlog";

vi.mock("@/lib/auth-client", () => ({ useSession: () => ({ data: null }) }));

const post = (slug: string, title: string, date: string) => ({
  slug,
  title,
  date,
  summary: `About ${title.toLowerCase()}.`,
});

const posts = [
  post("hobai-is-live", "hobai is live", "2026-11-02"),
  post("plans-and-usage-limits", "Plans and usage limits", "2026-10-26"),
  post("watching-a-run-live", "Watching a run live", "2026-10-24"),
];

describe("Devlog", () => {
  it("shows the newest post as the latest card and the rest under Earlier", () => {
    render(<Devlog posts={posts} />);

    expect(
      screen.getByRole("link", { current: "page", name: "Devlog" }),
    ).toHaveAttribute("href", "/devlog");
    const latest = screen.getByRole("link", { name: /hobai is live/ });
    expect(latest).toHaveAttribute("href", "/devlog/hobai-is-live");
    expect(within(latest).getByText("Nov 2, 2026")).toBeInTheDocument();

    const earlier = within(screen.getByRole("region", { name: "Earlier" }));
    expect(
      earlier.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual(["Plans and usage limits", "Watching a run live"]);
    expect(
      earlier.getByRole("link", { name: "Watching a run live" }),
    ).toHaveAttribute("href", "/devlog/watching-a-run-live");
  });

  it("offers the RSS feed, in the hero and the footer", () => {
    render(<Devlog posts={posts} />);

    expect(
      screen.getByRole("link", { name: "Follow with RSS" }),
    ).toHaveAttribute("href", "/devlog/rss.xml");
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: "RSS" })).toHaveAttribute(
      "href",
      "/devlog/rss.xml",
    );
    expect(footer.getByRole("link", { name: "Devlog" })).toHaveAttribute(
      "href",
      "/devlog",
    );
  });

  it("leaves out Earlier when there's only one post", () => {
    render(<Devlog posts={posts.slice(0, 1)} />);

    expect(screen.getByRole("link", { name: /hobai is live/ })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Earlier" })).toBeNull();
  });

  it("says so when there are no posts", () => {
    render(<Devlog posts={[]} />);

    expect(screen.getByText("No posts yet")).toBeInTheDocument();
  });
});
