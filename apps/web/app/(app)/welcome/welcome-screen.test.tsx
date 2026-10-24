import { fireEvent, render, screen, within } from "@testing-library/react";
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
        // "finished": every step done.
        index <
        (checklist.at === "finished"
          ? STEPS.length
          : STEPS.indexOf(checklist.at as (typeof STEPS)[number]))
          ? "done"
          : id === checklist.at
            ? "current"
            : "todo",
      href:
        id === "install"
          ? "https://github.com/apps/codegenie/installations/new"
          : "/projects/new",
      external: id === "install",
      projectName: id === "add-repo" || id === "set-up" ? "dodesk" : undefined,
      projectId: id === "set-up" || id === "first-task" ? "p1" : undefined,
    })),
    retry: vi.fn(),
  }),
}));
const setup = vi.hoisted(() => ({
  onboarding: null as unknown,
  latest: [] as string[],
  question: null as string | null,
  start: vi.fn(),
}));
vi.mock("@/features/setup/use-setup-progress", () => ({
  useSetupProgress: () => ({
    onboarding: setup.onboarding,
    active: ["queued", "running", "waiting"].includes(
      (setup.onboarding as { status?: string } | null)?.status ?? "",
    ),
    timeline: {
      latest: setup.latest,
      openQuestion: setup.question ? { question: setup.question } : null,
    },
  }),
}));
vi.mock("@/features/setup/use-onboarding", () => ({
  useStartOnboarding: () => ({
    mutate: setup.start,
    isPending: false,
    error: null,
  }),
}));
vi.mock("@/features/projects/projects", () => ({
  useProjects: () => ({ data: [] }),
}));
const tasks = vi.hoisted(() => ({
  list: [] as { id: string; title: string; label: string }[],
  start: vi.fn(),
}));
vi.mock("@/features/tasks/use-tasks", () => ({
  useTasks: () => ({ data: tasks.list }),
}));
vi.mock("@/features/tasks/use-new-task", () => ({
  useNewTask: () => ({
    text: "Add a /health endpoint",
    onTextChange: vi.fn(),
    projects: [
      { id: "p1", name: "dodesk", branch: "main", health: "ok", blocked: null },
    ],
    projectId: "p1",
    onProjectChange: vi.fn(),
    branch: "main",
    onBranchChange: vi.fn(),
    branchError: null,
    canStart: true,
    starting: false,
    error: null,
    onStart: tasks.start,
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
    setup.onboarding = null;
    setup.latest = [];
    setup.question = null;
    setup.start.mockReset();
    tasks.list = [];
    tasks.start.mockReset();
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
    expect(screen.getByRole("button", { name: "Start setup" })).toBeEnabled();
  });

  it("starts setup right inside step 3", () => {
    checklist.at = "set-up";
    render(<WelcomeScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
    expect(setup.start).toHaveBeenCalledOnce();
  });

  it("follows setup in step 3, and sends you to answer its question", () => {
    checklist.at = "set-up";
    setup.onboarding = { status: "running", startedAt: null, error: null };
    setup.latest = [
      "Found 2 projects",
      "Installed and ran checks: 4 of 5 checks passing",
    ];
    const { unmount } = render(<WelcomeScreen />);

    expect(screen.getByText("Setting up dodesk")).toBeInTheDocument();
    expect(screen.getByText("Found 2 projects")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch it live/ })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
    unmount();

    setup.onboarding = { status: "waiting", startedAt: null, error: null };
    setup.question = "Which tests?";
    render(<WelcomeScreen />);
    expect(screen.getByText("Which tests?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Answer" })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
  });

  it("says why setup stopped, and offers to try again", () => {
    checklist.at = "set-up";
    setup.onboarding = {
      status: "failed",
      startedAt: null,
      error: {
        message: "Setup stopped after waiting 30 minutes for an answer.",
      },
    };
    render(<WelcomeScreen />);

    expect(screen.getByRole("alert")).toHaveTextContent("waiting 30 minutes");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(setup.start).toHaveBeenCalledOnce();
  });

  it("starts the first task right inside step 4", () => {
    checklist.at = "first-task";
    render(<WelcomeScreen />);

    const step = screen.getByRole("listitem", { current: "step" });
    expect(step).toHaveTextContent("Describe your first task");
    expect(
      within(step).getByRole("textbox", { name: "Task description" }),
    ).toHaveValue("Add a /health endpoint");
    fireEvent.click(within(step).getByRole("button", { name: "Start" }));
    expect(tasks.start).toHaveBeenCalledOnce();
  });

  it("says the first task is running, with a way to watch it", () => {
    checklist.at = "finished";
    tasks.list = [
      { id: "t1", title: "Add a /health endpoint", label: "working" },
    ];
    render(<WelcomeScreen />);

    expect(
      screen.getByRole("heading", { name: "Your first task is running." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/“Add a \/health endpoint” is running\./),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Watch it work" })) {
      expect(link).toHaveAttribute("href", "/tasks/t1");
    }
  });

  it("goes back to the greeting once the first task has finished", () => {
    checklist.at = "finished";
    tasks.list = [
      { id: "t1", title: "Add a /health endpoint", label: "pr_open" },
    ];
    render(<WelcomeScreen />);

    expect(
      screen.getByRole("heading", { name: "Welcome, Ada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open it" })).toHaveAttribute(
      "href",
      "/tasks/t1",
    );
  });
});
