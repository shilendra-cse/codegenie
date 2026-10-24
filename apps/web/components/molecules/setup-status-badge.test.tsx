import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetupStatusBadge } from "./setup-status-badge";

describe("SetupStatusBadge", () => {
  it.each([
    ["queued", null, "Queued"],
    ["running", null, "Setting up"],
    ["waiting", null, "Waiting for your answer"],
    ["succeeded", 2, "Saved as v2"],
    ["failed", null, "Failed"],
    ["cancelled", null, "Stopped"],
  ] as const)("shows %s", (status, version, text) => {
    render(<SetupStatusBadge status={status} version={version} />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
