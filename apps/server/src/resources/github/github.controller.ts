import {
  ApiResponse,
  AuthenticatedController,
  AuthenticatedRequest,
} from "@/types/base.types";
import { isGitHubLinked, listRepos } from "./github.service";
import { ok } from "@/lib/api-response";

export const getUserGithubRepositories: AuthenticatedController = async (
  req: AuthenticatedRequest,
): Promise<ApiResponse> => {
  const repos = await listRepos(req.user.id);

  return ok(200, "OK", { repos });
};

export const getGitHubLinkedStatus: AuthenticatedController = async (
  req: AuthenticatedRequest,
): Promise<ApiResponse> => {
  const isLinked = await isGitHubLinked(req.user.id);
  return ok(200, "OK", { github: { isLinked } });
};
