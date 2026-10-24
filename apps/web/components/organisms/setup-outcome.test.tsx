import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SetupOutcome } from "./setup-outcome";

const base = { projectName: "dodesk", starting: false, startError: null };

describe("SetupOutcome", () => {
  it("offers to start setup", () => {
    const onStart = vi.fn();
    render(<SetupOutcome {...base} onStart={onStart} state="not-started" />);

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("says why setup failed, and offers to try again", () => {
    const onStart = vi.fn();
    render(
      <SetupOutcome
        {...base}
        onStart={onStart}
        state="failed"
        reason="Setup stopped after waiting 30 minutes for an answer."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Setup stopped after waiting 30 minutes for an answer.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("offers to start again after you stopped it, and shows why starting failed", () => {
    render(
      <SetupOutcome
        {...base}
        onStart={vi.fn()}
        state="stopped"
        startError="The GitHub App is suspended."
      />,
    );

    expect(
      screen.getByText("You stopped setup. Nothing was saved."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start again" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The GitHub App is suspended.",
    );
  });

  it("waits while it's queued", () => {
    render(<SetupOutcome {...base} onStart={vi.fn()} state="queued" />);
    expect(screen.getByText("Setup starts in a moment.")).toBeInTheDocument();
  });
});
