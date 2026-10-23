import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeScreen } from "./welcome-screen";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/account/use-account", () => ({
  useAccount: () => ({
    account: { name: "Ada Lovelace", email: "ada@example.com", image: null },
  }),
}));
vi.mock("@/features/onboarding/use-welcome-checklist", () => ({
  useWelcomeChecklist: () => ({
    status: "ready",
    steps: [
      {
        id: "install",
        state: "current",
        href: "https://github.com/apps/codegenie/installations/new",
        external: true,
      },
      { id: "add-repo", state: "todo", href: "/projects/new", external: false },
      { id: "set-up", state: "todo", href: "/projects/new", external: false },
      { id: "first-task", state: "todo", href: "/new", external: false },
    ],
    retry: vi.fn(),
  }),
}));

describe("WelcomeScreen", () => {
  beforeEach(() => router.replace.mockReset());

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
});
