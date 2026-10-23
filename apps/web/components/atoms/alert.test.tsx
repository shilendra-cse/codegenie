import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alert } from "./alert";

describe("Alert", () => {
  it("announces errors right away and other notes politely", () => {
    render(
      <>
        <Alert tone="error">Sign-in failed.</Alert>
        <Alert tone="warn">Setup needs attention.</Alert>
      </>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Sign-in failed.");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Setup needs attention.",
    );
  });
});
