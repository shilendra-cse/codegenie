import type { OnboardingResponse, ProjectResponse } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectFrame } from "./project-frame";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
let pathname = "/projects/p1";
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const REASON = 'Setup step "Install" (.) failed: `pnpm install`.';

const project = (
  overrides: Partial<ProjectResponse> = {},
): ProjectResponse => ({
  id: "p1",
  repo: { githubId: 1, owner: "ada", name: "dodesk" },
  defaultBranch: "main",
  environment: {
    version: 2,
    health: "needs_attention",
    healthReasons: [REASON],
    savedAt: "2026-10-22T08:00:00.000Z",
  },
  installation: {
    id: 1,
    accountLogin: "ada",
    accountType: "user",
    suspended: false,
    uninstalled: false,
  },
  setup: { id: "s1", status: "succeeded" },
  createdAt: "2026-10-20T08:00:00.000Z",
  ...overrides,
});

let projects: ProjectResponse[];

function renderFrame() {
  api.get.mockImplementation(async () => ({ data: { projects } }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectFrame projectId="p1">
        <p>Tab content</p>
      </ProjectFrame>
    </QueryClientProvider>,
  );
}

describe("ProjectFrame", () => {
  beforeEach(() => {
    pathname = "/projects/p1";
    projects = [project()];
    api.get.mockReset();
    api.post.mockReset();
    router.push.mockReset();
  });

  it("shows the project's tabs around the current one", async () => {
    pathname = "/projects/p1/environment";
    renderFrame();

    expect(
      await screen.findByRole("heading", { name: "dodesk" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Environment, needs attention" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "href",
      "/projects/p1",
    );
    expect(screen.getByText("Tab content")).toBeVisible();
  });

  it("links to Settings and marks it while it's open", async () => {
    pathname = "/projects/p1/settings";
    renderFrame();

    expect(
      await screen.findByRole("link", { name: "Settings" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("re-runs setup from the banner and opens the Environment tab", async () => {
    api.post.mockResolvedValue({
      data: {
        onboarding: { id: "s2", status: "queued" } as OnboardingResponse,
      },
    });
    renderFrame();

    expect(await screen.findByRole("status")).toHaveTextContent(REASON);
    fireEvent.click(screen.getByRole("button", { name: "Re-run setup" }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/projects/p1/environment"),
    );
    expect(api.post).toHaveBeenCalledWith("/projects/p1/onboarding");
  });

  it("hides the banner while a setup is in progress", async () => {
    projects = [project({ setup: { id: "s2", status: "running" } })];
    renderFrame();

    expect(
      await screen.findByRole("heading", { name: "dodesk" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Re-run setup" })).toBeNull();
  });

  it("hides the banner when the environment is healthy", async () => {
    projects = [
      project({
        environment: {
          version: 2,
          health: "ok",
          healthReasons: [],
          savedAt: "2026-10-22T08:00:00.000Z",
        },
      }),
    ];
    renderFrame();

    expect(
      await screen.findByRole("link", { name: "Environment" }),
    ).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says so when the project isn't one of yours", async () => {
    projects = [];
    renderFrame();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This project doesn't exist or isn't yours.",
    );
    expect(
      screen.getByRole("link", { name: "Go to the Inbox" }),
    ).toHaveAttribute("href", "/inbox");
    expect(screen.queryByText("Tab content")).toBeNull();
  });
});
