import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserMessage } from "./user-message";

describe("UserMessage", () => {
  it("shows who wrote it, when, and what, keeping line breaks", () => {
    render(
      <UserMessage
        name="Ada Lovelace"
        image={null}
        time="5 minutes ago"
        content={"Add a /health endpoint.\nReturn the version."}
      />,
    );
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
    expect(screen.getByText(/Return the version\./)).toHaveClass(
      "whitespace-pre-wrap",
    );
  });
});
