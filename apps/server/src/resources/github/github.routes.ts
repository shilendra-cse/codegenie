import { api } from "@/lib/ApiRouter";
import { getUserGithubRepositories } from "./github.controller";

api.get("/github/repositories").authSecure(getUserGithubRepositories);
