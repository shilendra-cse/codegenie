import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  SetupProgressCard,
  type SetupProgressCardProps,
} from "./setup-progress-card";

const base: SetupProgressCardProps = {
  projectName: "dodesk",
  status: null,
  href: "/projects/p1/environment",
  latest: [],
  elapsedMs: null,
  question: null,
  failure: null,
  onStart: vi.fn(),
  starting: false,
  startError: null,
};

describe("SetupProgressCard", () => {
  it("starts setup before the first one", () => {
    const onStart = vi.fn();
    render(<SetupProgressCard {...base} onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("follows setup with its latest lines and the beam", () => {
    const { container } = render(
      <SetupProgressCard
        {...base}
        status="running"
        elapsedMs={130_000}
        latest={["Found 2 projects", "Installed and ran checks"]}
      />,
    );

    expect(container.firstChild).toHaveClass("beam");
    expect(screen.getByText("Setting up dodesk")).toBeInTheDocument();
    expect(screen.getByText("2m 10s")).toBeInTheDocument();
    expect(screen.getByText("Installed and ran checks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch it live/ })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
  });

  it("asks you to answer when setup waits", () => {
    const { container } = render(
      <SetupProgressCard {...base} status="waiting" question="Which tests?" />,
    );

    expect(container.firstChild).not.toHaveClass("beam");
    expect(screen.getByText("Waiting for your answer")).toBeInTheDocument();
    expect(screen.getByText("Which tests?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Answer" })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
  });

  it("says why setup failed or was stopped, and offers to try again", () => {
    const { rerender } = render(
      <SetupProgressCard
        {...base}
        status="failed"
        failure="Couldn't install."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't install.");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();

    rerender(<SetupProgressCard {...base} status="cancelled" />);
    expect(
      screen.getByText("You stopped setup. Nothing was saved."),
    ).toBeInTheDocument();
  });

  it("is empty once saved, and waits while queued", () => {
    const { container, rerender } = render(
      <SetupProgressCard {...base} status="succeeded" />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<SetupProgressCard {...base} status="queued" />);
    expect(screen.getByText("Setup starts in a moment.")).toBeInTheDocument();
  });
});
