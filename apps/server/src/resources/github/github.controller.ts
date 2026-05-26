import {
  ApiResponse,
  AuthenticatedController,
  AuthenticatedRequest,
} from "@/types/base.types";
import { listRepos } from "./github.service";
import { ok } from "@/lib/api-response";

export const getUserGithubRepositories: AuthenticatedController = async (
  req: AuthenticatedRequest,
): Promise<ApiResponse> => {
  const repos = await listRepos(req.user.id);

  return ok(200, "OK", { repos });
};
