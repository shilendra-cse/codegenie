import { setTaskBranch, setTaskPullRequest, type Db } from "@codegenie/db";
import {
  commitToBranch,
  draftPullRequestsUnavailable,
  type GithubApp,
} from "@codegenie/github";
import type { Deliver } from "@codegenie/runner";
import type { RunEvent } from "@codegenie/shared";
import { repoInstallationId, type RepoProject } from "../github/repo-token.js";
import { branchName } from "./branch-name.js";
import { commitMessage, isDraft, pullRequestBody } from "./pull-request.js";

export type DeliverDeps = {
  db: Db;
  github: Pick<GithubApp, "repoClient">;
  frontendUrl?: string;
};

export type DeliveryTarget = {
  runId: string;
  task: { id: string; title: string; baseBranch: string };
  project: RepoProject;
  emit: (event: RunEvent) => void;
};

export function deliverToGithub(
  deps: DeliverDeps,
  { runId, task, project, emit }: DeliveryTarget,
): Deliver {
  return async (changes, run) => {
    const installationId = await repoInstallationId(deps.db, project);
    const client = await deps.github.repoClient(
      installationId,
      project.repoGithubId,
      { contents: "write", pull_requests: "write" },
    );
    const repo = { owner: project.repoOwner, repo: project.repoName };
    const branch = branchName(task);
    const title = run.agent.title ?? task.title;
    const ts = () => new Date().toISOString();

    const { sha } = await commitToBranch(client, {
      ...repo,
      branch,
      message: commitMessage(title, run.agent.summary),
      parent: changes.parent,
      tree: changes.tree,
      writes: changes.writes.map((file) => ({
        path: file.path,
        mode: file.mode,
        sha: file.sha,
        read: () => changes.readFile(file),
      })),
      deletions: changes.deletions,
    });
    await setTaskBranch(deps.db, task.id, branch);
    emit({ type: "branch_created", runId, ts: ts(), branchName: branch });
    emit({ type: "git_push", runId, ts: ts(), branchName: branch, sha });

    const request = {
      ...repo,
      title,
      head: branch,
      base: task.baseBranch,
    };
    const taskUrl = deps.frontendUrl && `${deps.frontendUrl}/tasks/${task.id}`;
    const draft = isDraft(run);
    let pullRequest;
    try {
      ({ data: pullRequest } = await client.rest.pulls.create({
        ...request,
        body: pullRequestBody(run, { taskUrl }),
        draft,
      }));
    } catch (error) {
      if (!draft || !draftPullRequestsUnavailable(error)) throw error;
      ({ data: pullRequest } = await client.rest.pulls.create({
        ...request,
        body: pullRequestBody(run, { draftUnavailable: true, taskUrl }),
      }));
    }
    await setTaskPullRequest(deps.db, task.id, {
      number: pullRequest.number,
      url: pullRequest.html_url,
      draft: pullRequest.draft ?? false,
    });
    emit({
      type: "pr_opened",
      runId,
      ts: ts(),
      prNumber: pullRequest.number,
      prUrl: pullRequest.html_url,
      draft: pullRequest.draft ?? false,
    });

    return { branchName: branch, sha };
  };
}
