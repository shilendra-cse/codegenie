import { config } from "@/config";
import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { currentUserId } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  getGitHubLinkedStatus,
  getUserGithubRepositories,
} from "./github.controller";
import { createInstallCallbackHandler } from "./github.install-callback";
import { githubAccessToken } from "./github.service";
import { createGithubWebhookHandler } from "./github.webhooks";

api.get("/github/repositories").authSecure(getUserGithubRepositories);
api.get("/github/status").authSecure(getGitHubLinkedStatus);

api.post("/github/webhooks").raw(
  createGithubWebhookHandler({
    db,
    secret: config.github.webhookSecret,
    log: (level, message, data) => logger[level](data ?? {}, message),
  }),
);

api.get("/github/installations/callback").raw(
  createInstallCallbackHandler({
    db,
    frontendUrl: config.client.url ?? "http://localhost:3000",
    currentUserId,
    githubToken: githubAccessToken,
  }),
);
