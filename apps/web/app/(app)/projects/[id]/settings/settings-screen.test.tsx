import type { ProjectResponse, TaskPage } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { SettingsScreen } from "./settings-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const project = (
  accountType: ProjectResponse["installation"]["accountType"],
): ProjectResponse => ({
  id: "p1",
  repo: { githubId: 1, owner: "acme", name: "dodesk" },
  defaultBranch: "main",
  environment: null,
  installation: {
    id: 42,
    accountLogin: "acme",
    accountType,
    suspended: false,
    uninstalled: false,
  },
  setup: null,
  createdAt: "2026-10-20T08:00:00.000Z",
});

const page: TaskPage = {
  tasks: [],
  nextCursor: null,
  counts: { all: 6, running: 0, pr: 2, done: 4 },
};

function renderScreen(
  accountType: ProjectResponse["installation"]["accountType"] = "organization",
) {
  api.get.mockImplementation(async (url: string) => ({
    data: url === "/projects" ? { projects: [project(accountType)] } : page,
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SettingsScreen projectId="p1" />
    </QueryClientProvider>,
  );
}

const askToRemove = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove project" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
};

describe("SettingsScreen", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.delete.mockReset().mockResolvedValue({ data: { id: "p1" } });
    router.replace.mockReset();
  });

  it("shows the repository, its default branch and GitHub access", async () => {
    renderScreen();

    expect(
      await screen.findByRole("link", { name: "acme/dodesk" }),
    ).toHaveAttribute("href", "https://github.com/acme/dodesk");
    expect(screen.getByText("main")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Manage on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/organizations/acme/settings/installations/42",
    );
  });

  it("manages a personal account's installation from the user's settings", async () => {
    renderScreen("user");

    expect(
      await screen.findByRole("link", { name: "Manage on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/settings/installations/42");
  });

  it("asks first, then removes the project and goes to the Inbox", async () => {
    renderScreen();

    await askToRemove();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/inbox"));
    expect(api.delete).toHaveBeenCalledWith("/projects/p1");
  });

  it("names the task count in the dialog", async () => {
    renderScreen();

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove project" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
        /^Its 6 tasks,/,
      ),
    );
  });

  it("is refused while a task is running", async () => {
    api.delete.mockRejectedValue(new ApiError(409, "Busy.", "PROJECT_BUSY"));
    renderScreen();

    await askToRemove();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A task is still running in this project. Wait for it to finish, or cancel it, then remove the project.",
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});
