import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";

const user = { name: "Ada Lovelace", email: "ada@example.com", image: null };

function open() {
  const handlers = {
    onThemeChange: vi.fn(),
    onShowUsage: vi.fn(),
    onSignOut: vi.fn(),
  };
  render(<AccountMenu user={user} theme="light" {...handlers} />);
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Ada Lovelace, account menu" }),
    { key: "Enter" },
  );
  return handlers;
}

describe("AccountMenu", () => {
  it("shows who is signed in", () => {
    open();

    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemradio", { name: "Light" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("switches the theme", () => {
    const { onThemeChange } = open();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("opens usage and limits", () => {
    const { onShowUsage } = open();

    fireEvent.click(screen.getByRole("menuitem", { name: "Usage & limits" }));

    expect(onShowUsage).toHaveBeenCalledOnce();
  });

  it("signs out", () => {
    const { onSignOut } = open();

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("holds the place while the session loads", () => {
    const { container } = render(
      <AccountMenu
        user={null}
        theme={undefined}
        onThemeChange={vi.fn()}
        onShowUsage={vi.fn()}
        onSignOut={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
