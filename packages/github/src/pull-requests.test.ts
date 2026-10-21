import { describe, expect, it } from "vitest";
import { draftPullRequestsUnavailable } from "./pull-requests.js";
import { fakeGithubClient } from "./testing/index.js";

describe("draftPullRequestsUnavailable", () => {
  it("recognizes GitHub refusing a draft pull request, and nothing else", async () => {
    const refusal = (message: string) =>
      fakeGithubClient(() => ({
        status: 422,
        body: {
          message: "Validation Failed",
          errors: [{ resource: "PullRequest", code: "custom", message }],
        },
      })).client.rest.pulls.create({
        owner: "acme",
        repo: "app",
        title: "t",
        head: "h",
        base: "main",
        draft: true,
      });

    await expect(
      refusal("Draft pull requests are not supported in this repository."),
    ).rejects.toSatisfy(draftPullRequestsUnavailable);
    await expect(
      refusal("A pull request already exists for acme:h."),
    ).rejects.not.toSatisfy(draftPullRequestsUnavailable);
    expect(draftPullRequestsUnavailable(new Error("draft"))).toBe(false);
  });
});
