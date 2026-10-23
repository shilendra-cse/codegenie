import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, initials } from "./avatar";

describe("Avatar", () => {
  it("shows the initials without a picture", () => {
    render(<Avatar name="Shilendra Singh" />);
    expect(screen.getByText("SS")).toBeInTheDocument();
  });

  it.each([
    ["Shilendra Singh", "SS"],
    ["shilendra-cse", "S"],
    ["  Ada  Lovelace Byron ", "AL"],
  ])("takes the initials of %j", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
