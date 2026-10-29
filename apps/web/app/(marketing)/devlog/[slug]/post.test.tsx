import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DevlogPost } from "./post";

const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: auth.session }),
}));

const post = {
  title: "hobai is live",
  date: "2026-11-02",
  summary: "Describe a task, get a pull request.",
  author: "Shilendra Singh",
};
const previous = {
  slug: "plans-and-usage-limits",
  title: "Plans and usage limits",
};

describe("DevlogPost", () => {
  it("shows the title, date, author, summary and body", () => {
    auth.session = null;
    render(
      <DevlogPost post={post} previous={previous}>
        <p>The body.</p>
      </DevlogPost>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "hobai is live" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nov 2, 2026")).toHaveAttribute(
      "datetime",
      "2026-11-02",
    );
    expect(screen.getByText("Shilendra Singh")).toBeInTheDocument();
    expect(
      screen.getByText("Describe a task, get a pull request."),
    ).toBeInTheDocument();
    expect(screen.getByText("The body.")).toBeInTheDocument();
  });

  it("links to the previous post and back to the list", () => {
    auth.session = null;
    render(
      <DevlogPost post={post} previous={previous}>
        {null}
      </DevlogPost>,
    );

    expect(
      screen.getByRole("link", { name: /Plans and usage limits/ }),
    ).toHaveAttribute("href", "/devlog/plans-and-usage-limits");
    expect(
      screen.getByRole("link", { name: /Back to the devlog/ }),
    ).toHaveAttribute("href", "/devlog");
  });

  it("has no previous link on the oldest post", () => {
    auth.session = null;
    render(
      <DevlogPost post={post} previous={null}>
        {null}
      </DevlogPost>,
    );

    expect(screen.queryByText("Previous")).toBeNull();
  });

  it("invites signed-out readers to start, and not signed-in ones", () => {
    auth.session = null;
    const { unmount } = render(
      <DevlogPost post={post} previous={null}>
        {null}
      </DevlogPost>,
    );
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/signin",
    );
    unmount();

    auth.session = { user: { id: "u1" } };
    render(
      <DevlogPost post={post} previous={null}>
        {null}
      </DevlogPost>,
    );
    expect(screen.queryByRole("link", { name: "Start free" })).toBeNull();
  });
});
