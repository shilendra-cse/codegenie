import { describe, expect, it } from "vitest";
import { branchName, slugify } from "./branch-name.js";

describe("branchName", () => {
  it("names the branch after the task", () => {
    expect(
      branchName({
        id: "1234abcd-0000-0000-0000-000000000000",
        title: "Add a /health endpoint",
      }),
    ).toBe("codegenie/add-a-health-endpoint-1234");
  });

  it.each([
    ["Réparer l'API — vite!", "reparer-l-api-vite"],
    ["  --Fix   it--  ", "fix-it"],
    ["日本語のタスク", "changes"],
    [
      "Make the checkout page faster for customers on slow connections",
      "make-the-checkout-page-faster-for-custom",
    ],
    [
      "Fix a bug in the very long module name xx-",
      "fix-a-bug-in-the-very-long-module-name-x",
    ],
  ])("slugifies %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });
});
