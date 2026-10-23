import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountPicker } from "./account-picker";

describe("AccountPicker", () => {
  it("switches between your GitHub accounts", () => {
    const onSelect = vi.fn();
    render(
      <AccountPicker
        installations={[
          { id: 1, accountLogin: "ada", accountType: "user" },
          { id: 2, accountLogin: "acme", accountType: "organization" },
        ]}
        selectedId={1}
        onSelect={onSelect}
      />,
    );

    fireEvent.keyDown(
      screen.getByRole("button", { name: "GitHub account: ada" }),
      { key: "Enter" },
    );
    expect(screen.getByRole("menuitemradio", { name: "ada" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "acme organisation" }),
    );

    expect(onSelect).toHaveBeenCalledWith(2);
  });
});
