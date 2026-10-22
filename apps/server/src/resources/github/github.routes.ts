import { findUserProjectRepos } from "@codegenie/db";
import { config } from "@/config";
import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { currentUserId } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { githubApp } from "@/lib/github-app";
import { createGithubControllers } from "./github.controller";
import { createInstallCallbackHandler } from "./github.install-callback";
import { githubAccessToken } from "./github.service";
import { createGithubWebhookHandler } from "./github.webhooks";

const github = createGithubControllers({
  githubToken: githubAccessToken,
  installUrl: async () =>
    `https://github.com/apps/${await githubApp.slug()}/installations/new`,
  userProjectRepos: (userId) => findUserProjectRepos(db, userId),
});

api.get("/github/installations").authSecure(github.getInstallations);
api
  .get("/github/installations/:id/repositories")
  .authSecure(github.getInstallationRepositories);

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
