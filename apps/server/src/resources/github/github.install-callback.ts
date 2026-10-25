import { type Db, recordInstallation } from "@hobai/db";
import { listUserInstallations } from "@hobai/github";
import type { Request, RequestHandler } from "express";

export type InstallCallbackDeps = {
  db: Db;
  frontendUrl: string;
  currentUserId(req: Request): Promise<string | null>;
  githubToken(userId: string): Promise<string | null>;
  fetch?: typeof fetch;
};

export function createInstallCallbackHandler(
  deps: InstallCallbackDeps,
): RequestHandler {
  // The install link's state names the page to return to; only known pages, so it can't redirect anywhere else.
  const returnPage = (req: Request) =>
    req.query.state === "add-repo" ? "/projects/new" : "/welcome";
  const signIn = (req: Request) =>
    `${deps.frontendUrl}/signin?next=${encodeURIComponent(returnPage(req))}`;
  const back = (req: Request, outcome: string) =>
    `${deps.frontendUrl}${returnPage(req)}?github=${outcome}`;

  return async (req, res) => {
    const userId = await deps.currentUserId(req);
    if (!userId) {
      res.redirect(signIn(req));
      return;
    }
    const installationId = Number(req.query.installation_id);
    if (!Number.isInteger(installationId) || installationId <= 0) {
      res.redirect(
        back(
          req,
          req.query.setup_action === "request" ? "requested" : "cancelled",
        ),
      );
      return;
    }
    const token = await deps.githubToken(userId);
    if (!token) {
      res.redirect(signIn(req));
      return;
    }

    // The installation id arrives in the URL, so only the user's own GitHub access proves it's theirs.
    const installations = await listUserInstallations(token, {
      fetch: deps.fetch,
    });
    const installation = installations.find((i) => i.id === installationId);
    if (!installation) {
      res.redirect(back(req, "not-found"));
      return;
    }
    await recordInstallation(deps.db, {
      installationId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      installedByUserId: userId,
    });
    res.redirect(back(req, "installed"));
  };
}
