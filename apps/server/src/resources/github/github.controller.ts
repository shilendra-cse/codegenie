import {
  listInstallationRepos,
  listUserInstallations,
} from "@codegenie/github";
import { ok } from "@/lib/api-response";
import { HttpError } from "@/lib/http-error";
import type { AuthenticatedController } from "@/types/base.types";

export type GithubControllerDeps = {
  githubToken(userId: string): Promise<string | null>;
  installUrl(): Promise<string>;
  fetch?: typeof fetch;
};

export function createGithubControllers(deps: GithubControllerDeps) {
  const requireToken = async (userId: string) => {
    const token = await deps.githubToken(userId);
    if (!token) {
      throw new HttpError(
        401,
        "Sign in with GitHub again to continue.",
        "GITHUB_SIGN_IN_REQUIRED",
      );
    }
    return token;
  };

  const getInstallations: AuthenticatedController = async (req) => {
    const token = await requireToken(req.user.id);
    const installations = await listUserInstallations(token, {
      fetch: deps.fetch,
    });
    return ok(200, "OK", {
      installations,
      installUrl: await deps.installUrl(),
    });
  };

  const getInstallationRepositories: AuthenticatedController = async (req) => {
    const installationId = Number(req.params.id);
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new HttpError(
        400,
        "The installation id must be a positive integer.",
      );
    }
    const token = await requireToken(req.user.id);
    const repositories = await listInstallationRepos(token, installationId, {
      fetch: deps.fetch,
    });
    if (!repositories) {
      throw new HttpError(
        404,
        "Installation not found.",
        "GITHUB_INSTALLATION_NOT_FOUND",
      );
    }
    repositories.sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
    );
    return ok(200, "OK", { repositories });
  };

  return { getInstallations, getInstallationRepositories };
}
