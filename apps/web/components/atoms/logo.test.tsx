import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it.each(["full", "mark"] as const)(
    "shows the black %s logo in light mode and the white one in dark mode",
    (variant) => {
      render(<Logo variant={variant} />);
      const [black, white] = screen
        .getByRole("img", { name: "CodeGenie" })
        .querySelectorAll("img");

      expect(black!.getAttribute("src")).toContain("black");
      expect(black).toHaveClass("dark:hidden");
      expect(white!.getAttribute("src")).toContain("white");
      expect(white).toHaveClass("hidden", "dark:block");
    },
  );
});
