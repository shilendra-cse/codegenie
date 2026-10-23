import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInScreen } from "./sign-in-screen";

const auth = vi.hoisted(() => ({
  session: null as unknown,
  signInWithGitHub: vi.fn(),
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: auth.session }),
  signInWithGitHub: auth.signInWithGitHub,
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const button = () =>
  screen.getByRole("button", { name: "Continue with GitHub" });

describe("SignInScreen", () => {
  beforeEach(() => {
    auth.session = null;
    auth.signInWithGitHub.mockReset();
    router.replace.mockReset();
  });

  it("signs in with GitHub and returns to the page that asked", () => {
    auth.signInWithGitHub.mockReturnValue(new Promise(() => {}));
    render(<SignInScreen next="/projects/42" failed={false} />);

    fireEvent.click(button());

    expect(auth.signInWithGitHub).toHaveBeenCalledWith("/projects/42");
    expect(button()).toBeDisabled();
  });

  it("shows the failure from GitHub, and when starting sign-in fails", async () => {
    render(<SignInScreen failed />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    auth.signInWithGitHub.mockResolvedValue({
      data: null,
      error: { status: 500 },
    });
    fireEvent.click(button());

    await waitFor(() => expect(button()).toBeEnabled());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("sends someone already signed in straight on, only within the site", () => {
    auth.session = { user: { id: "u1" } };

    render(<SignInScreen next="https://evil.example" failed={false} />);

    expect(router.replace).toHaveBeenCalledWith("/build");
  });
});
