import { createGithubApp } from "@codegenie/github";
import { config } from "@/config";

export const githubApp = createGithubApp({
  appId: config.github.appId,
  privateKey: config.github.privateKey,
});
