import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryRow, type RepositoryRowProps } from "./repository-row";

const repo: RepositoryRowProps["repo"] = {
  name: "dodesk",
  private: true,
  language: "TypeScript",
  updatedAt: "2026-10-23T10:00:00Z",
  projectId: null,
};

function renderRow(props: Partial<RepositoryRowProps> = {}) {
  const onAdd = vi.fn();
  render(<RepositoryRow repo={repo} adding={false} onAdd={onAdd} {...props} />);
  return onAdd;
}

describe("RepositoryRow", () => {
  beforeEach(() =>
    vi.useFakeTimers({ now: Date.parse("2026-10-23T12:00:00Z") }),
  );
  afterEach(() => vi.useRealTimers());

  it("shows the repository and adds it", () => {
    const onAdd = renderRow();

    expect(screen.getByText("Private")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Updated 2 hours ago")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add dodesk" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("is busy while adding", () => {
    renderRow({ adding: true });

    expect(screen.getByRole("button", { name: "Add dodesk" })).toBeDisabled();
  });

  it("opens the project once added", () => {
    renderRow({ repo: { ...repo, projectId: "p1" } });

    expect(screen.getByRole("link", { name: "Added · Open" })).toHaveAttribute(
      "href",
      "/projects/p1",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("warns about a repository that isn't JavaScript or TypeScript, until it's added", () => {
    renderRow({ repo: { ...repo, language: "Python" } });
    expect(
      screen.getByText(/Doesn't look like JavaScript or TypeScript/),
    ).toBeInTheDocument();
  });

  it("doesn't warn once added, or for JavaScript", () => {
    renderRow({ repo: { ...repo, language: "Python", projectId: "p1" } });
    renderRow({ repo: { ...repo, language: "JavaScript" } });
    expect(screen.queryByText(/Doesn't look like/)).toBeNull();
  });

  it("explains why adding failed", () => {
    renderRow({ error: "The GitHub App is suspended on this account." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The GitHub App is suspended on this account.",
    );
  });
});
