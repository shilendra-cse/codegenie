import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeScreen } from "./welcome-screen";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/account/use-account", () => ({
  useAccount: () => ({
    account: { name: "Ada Lovelace", email: "ada@example.com", image: null },
  }),
}));
const checklist = vi.hoisted(() => ({ at: "install" }));
const picker = vi.hoisted(() => ({ enabled: false as boolean | undefined }));
const STEPS = ["install", "add-repo", "set-up", "first-task"] as const;
vi.mock("@/features/onboarding/use-welcome-checklist", () => ({
  useWelcomeChecklist: () => ({
    status: "ready",
    steps: STEPS.map((id, index) => ({
      id,
      state:
        index < STEPS.indexOf(checklist.at as (typeof STEPS)[number])
          ? "done"
          : id === checklist.at
            ? "current"
            : "todo",
      href:
        id === "install"
          ? "https://github.com/apps/codegenie/installations/new"
          : "/projects/new",
      external: id === "install",
      projectName: id === "add-repo" ? "dodesk" : undefined,
    })),
    retry: vi.fn(),
  }),
}));
vi.mock("@/features/github/use-repository-picker", () => ({
  useRepositoryPicker: ({ enabled }: { enabled?: boolean }) => {
    picker.enabled = enabled;
    return {
      installations: [{ id: 1, accountLogin: "ada", accountType: "user" }],
      selectedId: 1,
      onSelect: vi.fn(),
      repositories: [],
      failed: false,
      onRetry: vi.fn(),
      installUrl: "",
      manageUrl: undefined,
      adding: new Set(),
      errors: new Map(),
      onAdd: vi.fn(),
    };
  },
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    router.replace.mockReset();
    checklist.at = "install";
  });

  it("greets you and shows the checklist", () => {
    render(<WelcomeScreen />);

    expect(
      screen.getByRole("heading", { name: "Welcome, Ada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Install on GitHub" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["installed", "GitHub App installed."],
    [
      "requested",
      "Installation requested. An owner of the organisation needs to approve it.",
    ],
    ["cancelled", "Installation cancelled."],
    ["not-found", "We couldn't find that installation on your account."],
  ])(
    "tells you how the install went (%s), then tidies the address",
    (github, text) => {
      render(<WelcomeScreen github={github} />);

      expect(screen.getByText(text)).toBeInTheDocument();
      expect(router.replace).toHaveBeenCalledWith("/welcome", {
        scroll: false,
      });
    },
  );

  it("ignores an outcome it doesn't know", () => {
    render(<WelcomeScreen github="toString" />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/welcome", { scroll: false });
  });

  it("adds a repository right inside step 2", () => {
    checklist.at = "add-repo";
    render(<WelcomeScreen />);

    const step = screen.getByRole("listitem", { current: "step" });
    expect(step).toHaveTextContent("Add a repository");
    expect(
      within(step).getByRole("searchbox", { name: "Search repositories" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Choose a repository" }),
    ).toBeNull();
    expect(picker.enabled).toBe(true);
  });

  it("only loads repositories while step 2 is open, then says what was added", () => {
    checklist.at = "set-up";
    render(<WelcomeScreen />);

    expect(picker.enabled).toBe(false);
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByText("dodesk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start setup" })).toBeDisabled();
  });
});
