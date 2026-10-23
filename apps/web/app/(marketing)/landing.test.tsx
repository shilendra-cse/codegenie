import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Landing } from "./landing";

const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: auth.session }),
}));

describe("Landing", () => {
  it("leads every sign-in button to the sign-in page", () => {
    auth.session = null;
    render(<Landing />);

    for (const name of ["Sign in", "Get started", "Sign in with GitHub"]) {
      for (const link of screen.getAllByRole("link", { name })) {
        expect(link).toHaveAttribute("href", "/signin");
      }
    }
    expect(screen.queryByRole("link", { name: "Open CodeGenie" })).toBeNull();
  });

  it("links its menu to its own sections", () => {
    auth.session = null;
    const { container } = render(<Landing />);

    for (const id of ["how", "trust"]) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
      expect(
        screen
          .getAllByRole("link")
          .some((l) => l.getAttribute("href") === `#${id}`),
      ).toBe(true);
    }
  });

  it("offers to open the app when already signed in", () => {
    auth.session = { user: { id: "u1" } };
    render(<Landing />);

    const open = screen.getAllByRole("link", { name: "Open CodeGenie" });
    expect(open.length).toBeGreaterThan(0);
    open.forEach((link) => expect(link).toHaveAttribute("href", "/welcome"));
    expect(screen.queryByRole("link", { name: "Get started" })).toBeNull();
  });
});
