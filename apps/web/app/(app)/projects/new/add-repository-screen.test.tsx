import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { AddRepositoryScreen } from "./add-repository-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const repo = (id: number, name: string) => ({
  id,
  fullName: `x/${name}`,
  owner: "x",
  name,
  defaultBranch: "main",
  private: false,
  htmlUrl: "",
  updatedAt: null,
  language: "TypeScript",
  projectId: null,
});

const responses: Record<string, unknown> = {
  "/github/installations": {
    installations: [
      { id: 1, accountLogin: "ada", accountType: "user" },
      { id: 2, accountLogin: "acme", accountType: "organization" },
    ],
    installUrl: "https://github.com/apps/hobai/installations/new",
  },
  "/github/installations/1/repositories": {
    repositories: [repo(10, "dodesk")],
  },
  "/github/installations/2/repositories": {
    repositories: [repo(20, "platform")],
  },
  "/projects": { projects: [] },
};

function renderScreen(github?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AddRepositoryScreen github={github} />
    </QueryClientProvider>,
  );
}

describe("AddRepositoryScreen", () => {
  beforeEach(() => {
    router.replace.mockReset();
    api.get
      .mockReset()
      .mockImplementation(async (url: string) => ({ data: responses[url] }));
    api.post.mockReset();
  });

  it("adds a repository from the first account", async () => {
    let finish: (value: unknown) => void = () => {};
    api.post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Add dodesk" }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/projects", {
        installationId: 1,
        repoId: 10,
      }),
    );
    expect(screen.getByRole("button", { name: "Add dodesk" })).toBeDisabled();
    finish({ data: { project: { id: "p1" } } });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add dodesk" })).toBeEnabled(),
    );
  });

  it("explains in the row why adding failed", async () => {
    api.post.mockRejectedValue(
      new ApiError(409, "Suspended.", "GITHUB_INSTALLATION_SUSPENDED"),
    );
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Add dodesk" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The GitHub App is suspended on this account.",
    );
  });

  it("shows another account's repositories when you switch", async () => {
    renderScreen();
    fireEvent.keyDown(
      await screen.findByRole("button", { name: "GitHub account: ada" }),
      { key: "Enter" },
    );
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "acme organisation" }),
    );

    expect(
      await screen.findByRole("button", { name: "Add platform" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Change which repositories/ }),
    ).toHaveAttribute(
      "href",
      "https://github.com/organizations/acme/settings/installations/2",
    );
  });

  it("asks GitHub to come back here when installing from this page", async () => {
    api.get.mockResolvedValue({
      data: {
        installations: [],
        installUrl: "https://github.com/apps/hobai/installations/new",
      },
    });
    renderScreen();

    expect(
      await screen.findByRole("link", { name: "Install on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/apps/hobai/installations/new?state=add-repo",
    );
  });

  it("tells you how the install went, then tidies the address", async () => {
    renderScreen("installed");

    expect(screen.getByText("GitHub App installed.")).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith("/projects/new", {
      scroll: false,
    });
  });
});
