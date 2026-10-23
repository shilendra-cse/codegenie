import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInCard } from "./sign-in-card";

describe("SignInCard", () => {
  it("starts sign-in from its button", () => {
    const onSignIn = vi.fn();
    render(<SignInCard busy={false} error={false} onSignIn={onSignIn} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    expect(onSignIn).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("can't be pressed twice while signing in", () => {
    render(<SignInCard busy error={false} onSignIn={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeDisabled();
  });

  it("says when GitHub didn't complete the sign-in", () => {
    render(<SignInCard busy={false} error onSignIn={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "GitHub didn't complete the sign-in. Try again.",
    );
  });
});
