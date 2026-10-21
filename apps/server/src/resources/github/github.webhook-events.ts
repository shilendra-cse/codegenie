import {
  type Db,
  findUserIdByGithubId,
  markInstallationUninstalled,
  recordInstallation,
  setInstallationSuspended,
  setTaskStatusForPullRequest,
} from "@codegenie/db";
import { z } from "zod";

export type WebhookLog = (
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>,
) => void;

export type WebhookDeps = { db: Db; log: WebhookLog };

const installationEvent = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number(),
    account: z.object({ login: z.string(), type: z.string() }),
  }),
  sender: z.object({ id: z.number(), login: z.string() }),
});

const repositories = z.array(z.object({ full_name: z.string() })).default([]);

const installationRepositoriesEvent = z.object({
  action: z.string(),
  installation: z.object({ id: z.number() }),
  repositories_added: repositories,
  repositories_removed: repositories,
});

const pullRequestEvent = z.object({
  action: z.string(),
  pull_request: z.object({
    number: z.number(),
    state: z.enum(["open", "closed"]),
    merged: z.boolean().nullish(),
  }),
  repository: z.object({ id: z.number(), full_name: z.string() }),
});

// The PR's state, not the action, so repeated or redelivered events set the same status again.
async function handlePullRequest(
  { db, log }: WebhookDeps,
  event: z.infer<typeof pullRequestEvent>,
) {
  const pr = event.pull_request;
  const status =
    pr.state === "open" ? "pr_open" : pr.merged ? "merged" : "closed";
  const changed = await setTaskStatusForPullRequest(
    db,
    { repoGithubId: event.repository.id, number: pr.number },
    status,
  );
  if (changed.length === 0) return;
  log("info", "Pull request status recorded", {
    repo: event.repository.full_name,
    number: pr.number,
    action: event.action,
    status,
    taskIds: changed.map((t) => t.id),
  });
}

async function handleInstallation(
  { db, log }: WebhookDeps,
  event: z.infer<typeof installationEvent>,
) {
  const installationId = event.installation.id;
  const { account } = event.installation;
  switch (event.action) {
    case "created": {
      const userId = await findUserIdByGithubId(db, event.sender.id);
      if (!userId) {
        log("warn", "Installed by a GitHub user who hasn't signed in", {
          installationId,
          sender: event.sender.login,
        });
        return;
      }
      await recordInstallation(db, {
        installationId,
        accountLogin: account.login,
        accountType: account.type === "Organization" ? "organization" : "user",
        installedByUserId: userId,
      });
      log("info", "Installation recorded", {
        installationId,
        account: account.login,
      });
      return;
    }
    case "deleted":
      await markInstallationUninstalled(db, installationId);
      log("info", "Installation removed", { installationId });
      return;
    case "suspend":
    case "unsuspend":
      await setInstallationSuspended(
        db,
        installationId,
        event.action === "suspend",
      );
      log("info", `Installation ${event.action}ed`, { installationId });
      return;
  }
}

export async function handleGithubEvent(
  deps: WebhookDeps,
  name: string,
  payload: unknown,
) {
  switch (name) {
    case "installation":
      return handleInstallation(deps, installationEvent.parse(payload));
    case "pull_request":
      return handlePullRequest(deps, pullRequestEvent.parse(payload));
    case "installation_repositories": {
      const event = installationRepositoriesEvent.parse(payload);
      deps.log("info", "Installation repositories changed", {
        installationId: event.installation.id,
        added: event.repositories_added.map((r) => r.full_name),
        removed: event.repositories_removed.map((r) => r.full_name),
      });
      return;
    }
  }
}
