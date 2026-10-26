import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Pricing } from "./pricing";

const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({ data: auth.session }),
}));

const card = (name: string) =>
  within(screen.getByRole("region", { name: `${name} plan` }));

describe("Pricing", () => {
  it("shows the free plan with a way to start, and Pro coming soon", () => {
    auth.session = null;
    render(<Pricing />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Simple pricing" }),
    ).toBeInTheDocument();
    const free = card("Free");
    expect(free.getByText("₹0")).toBeInTheDocument();
    expect(free.getByRole("link", { name: "Start free" })).toHaveAttribute(
      "href",
      "/signin",
    );
    const pro = card("Pro");
    expect(pro.getAllByText("Coming soon").length).toBeGreaterThan(0);
    expect(pro.getByRole("button", { name: "Coming soon" })).toBeDisabled();
  });

  it("answers what a run is and when runs reset", () => {
    auth.session = null;
    render(<Pricing />);

    expect(screen.getByText("What's a run?")).toBeInTheDocument();
    expect(screen.getByText("When do my runs reset?")).toBeInTheDocument();
    expect(
      screen.getByText("Does setting up a repository count?"),
    ).toBeInTheDocument();
  });

  it("marks Pricing as the current page and links back to the landing page's sections", () => {
    auth.session = null;
    render(<Pricing />);

    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/#how",
    );
  });

  it("says Free is your plan and opens the app when signed in", () => {
    auth.session = { user: { id: "u1" } };
    render(<Pricing />);

    expect(screen.getByText("Your plan")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Start free" })).toBeNull();
    for (const link of screen.getAllByRole("link", {
      name: `Open ${PRODUCT_NAME}`,
    })) {
      expect(link).toHaveAttribute("href", "/inbox");
    }
  });
});
