import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioCard } from "./radio-card";

describe("RadioCard", () => {
  it("is a real radio that can be chosen", () => {
    const onSelect = vi.fn();
    render(
      <RadioCard name="q" checked={false} onSelect={onSelect}>
        Skip them
      </RadioCard>,
    );
    const radio = screen.getByRole("radio", { name: "Skip them" });

    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    expect(onSelect).toHaveBeenCalledOnce();
  });
});
