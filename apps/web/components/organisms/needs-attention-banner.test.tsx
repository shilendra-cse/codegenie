import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NeedsAttentionBanner } from "./needs-attention-banner";

describe("NeedsAttentionBanner", () => {
  it("says why and re-runs setup", () => {
    const onRerun = vi.fn();
    render(
      <NeedsAttentionBanner
        reasons={['Setup step "Install" (.) failed: `pnpm install`.']}
        onRerun={onRerun}
        rerunning={false}
        error={null}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      'Setup needs attention. Setup step "Install" (.) failed: `pnpm install`.',
    );
    fireEvent.click(screen.getByRole("button", { name: "Re-run setup" }));
    expect(onRerun).toHaveBeenCalledOnce();
  });

  it("shows when the re-run couldn't start", () => {
    render(
      <NeedsAttentionBanner
        reasons={[]}
        onRerun={() => {}}
        rerunning={false}
        error="Couldn't start the setup. Try again."
      />,
    );

    expect(
      screen.getByText("Couldn't start the setup. Try again."),
    ).toBeVisible();
  });
});
