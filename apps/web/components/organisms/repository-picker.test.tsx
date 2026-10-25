import type { GitHubRepo } from "@hobai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import {
  RepositoryPicker,
  type RepositoryPickerProps,
} from "./repository-picker";

const repo = (id: number, name: string): GitHubRepo => ({
  id,
  fullName: `ada/${name}`,
  owner: "ada",
  name,
  defaultBranch: "main",
  private: false,
  htmlUrl: `https://github.com/ada/${name}`,
  updatedAt: null,
  language: "TypeScript",
  projectId: null,
});

const props: RepositoryPickerProps = {
  installations: [{ id: 1, accountLogin: "ada", accountType: "user" }],
  selectedId: 1,
  onSelect: vi.fn(),
  repositories: [repo(10, "dodesk"), repo(11, "buyerbook")],
  failed: false,
  onRetry: vi.fn(),
  installUrl:
    "https://github.com/apps/hobai/installations/new?state=add-repo",
  manageUrl: "https://github.com/settings/installations/1",
  adding: new Set(),
  errors: new Map(),
  onAdd: vi.fn(),
};

describe("RepositoryPicker", () => {
  it("lists the account's repositories, with a link to change access", () => {
    render(<RepositoryPicker {...props} />);

    expect(
      screen.getByRole("button", { name: "Add dodesk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add buyerbook" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: new RegExp(`Change which repositories ${PRODUCT_NAME} can access`),
      }),
    ).toHaveAttribute("href", "https://github.com/settings/installations/1");
  });

  it("filters by name as you type, and says when nothing matches", () => {
    render(<RepositoryPicker {...props} />);
    const search = screen.getByRole("searchbox", {
      name: "Search repositories",
    });

    fireEvent.change(search, { target: { value: "DOD" } });
    expect(
      screen.getByRole("button", { name: "Add dodesk" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add buyerbook" })).toBeNull();

    fireEvent.change(search, { target: { value: "nope" } });
    expect(
      screen.getByText('No repositories match "nope".'),
    ).toBeInTheDocument();
  });

  it("passes on which repository to add", () => {
    const onAdd = vi.fn();
    render(<RepositoryPicker {...props} onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: "Add buyerbook" }));
    expect(onAdd).toHaveBeenCalledWith(11);
  });

  it("offers to install the GitHub App when there are no accounts", () => {
    render(
      <RepositoryPicker {...props} installations={[]} selectedId={undefined} />,
    );

    expect(
      screen.getByRole("link", { name: "Install on GitHub" }),
    ).toHaveAttribute("href", props.installUrl);
  });

  it("says so when an account shares no repositories", () => {
    render(<RepositoryPicker {...props} repositories={[]} />);

    expect(
      screen.getByText(
        `No repositories are shared with ${PRODUCT_NAME} on this account.`,
      ),
    ).toBeInTheDocument();
  });

  it("shows placeholders while loading", () => {
    render(
      <RepositoryPicker
        {...props}
        installations={undefined}
        repositories={undefined}
      />,
    );
    expect(screen.getByLabelText("Loading repositories")).toBeInTheDocument();
  });

  it("offers to try again when loading failed", () => {
    const onRetry = vi.fn();
    render(
      <RepositoryPicker
        {...props}
        repositories={undefined}
        failed
        onRetry={onRetry}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
