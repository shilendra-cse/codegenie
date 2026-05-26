import { api } from "@/lib/ApiRouter";
import {
  getGitHubLinkedStatus,
  getUserGithubRepositories,
} from "./github.controller";

api.get("/github/repositories").authSecure(getUserGithubRepositories);
api.get("/github/status").authSecure(getGitHubLinkedStatus);
