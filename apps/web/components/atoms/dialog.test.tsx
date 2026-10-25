import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";

function Example() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Remove dodesk?</DialogTitle>
        <DialogDescription>GitHub is not touched.</DialogDescription>
        <DialogClose asChild>
          <Button>Cancel</Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("is named by its title and described by its description", () => {
    render(<Example />);

    const dialog = screen.getByRole("dialog", { name: "Remove dodesk?" });
    expect(dialog).toHaveAccessibleDescription("GitHub is not touched.");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("closes from its close button", () => {
    render(<Example />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", () => {
    render(<Example />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
