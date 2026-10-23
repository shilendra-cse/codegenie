import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { addProjectError } from "./create-project";

describe("addProjectError", () => {
  it.each([
    [
      new ApiError(409, "Suspended.", "GITHUB_INSTALLATION_SUSPENDED"),
      "The GitHub App is suspended on this account.",
    ],
    [
      new ApiError(404, "Not found.", "GITHUB_REPOSITORY_NOT_FOUND"),
      "This repository is no longer available to CodeGenie.",
    ],
    [
      new ApiError(404, "Not found.", "GITHUB_INSTALLATION_NOT_FOUND"),
      "This repository is no longer available to CodeGenie.",
    ],
    [
      new ApiError(
        0,
        "Couldn't reach CodeGenie. Check your connection and try again.",
      ),
      "Couldn't reach CodeGenie. Check your connection and try again.",
    ],
    [new Error("boom"), "Something went wrong. Try again."],
  ])("explains %s", (error, message) => {
    expect(addProjectError(error)).toBe(message);
  });
});
