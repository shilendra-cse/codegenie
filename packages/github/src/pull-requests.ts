import { RequestError } from "@octokit/request-error";

/** GitHub Free has no draft pull requests in private repositories; GitHub refuses them with a 422. */
export function draftPullRequestsUnavailable(error: unknown) {
  return (
    error instanceof RequestError &&
    error.status === 422 &&
    /draft pull requests are not supported/i.test(error.message)
  );
}
