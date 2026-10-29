import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevlogDate } from "./devlog-date";

describe("DevlogDate", () => {
  it.each([
    ["2026-01-01", "Jan 1, 2026"],
    ["2026-12-31", "Dec 31, 2026"],
  ])("shows %s as %s, without shifting a day", (date, shown) => {
    render(<DevlogDate date={date} />);

    expect(screen.getByText(shown)).toHaveAttribute("datetime", date);
  });
});
