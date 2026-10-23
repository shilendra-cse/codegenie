import { type Db, recordInstallation } from "@codegenie/db";
import { listUserInstallations } from "@codegenie/github";
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
  const signIn = `${deps.frontendUrl}/signin?next=${encodeURIComponent("/welcome")}`;
  const back = (outcome: string) =>
    `${deps.frontendUrl}/welcome?github=${outcome}`;

  return async (req, res) => {
    const userId = await deps.currentUserId(req);
    if (!userId) {
      res.redirect(signIn);
      return;
    }
    const installationId = Number(req.query.installation_id);
    if (!Number.isInteger(installationId) || installationId <= 0) {
      res.redirect(
        back(req.query.setup_action === "request" ? "requested" : "cancelled"),
      );
      return;
    }
    const token = await deps.githubToken(userId);
    if (!token) {
      res.redirect(signIn);
      return;
    }

    // The installation id arrives in the URL, so only the user's own GitHub access proves it's theirs.
    const installations = await listUserInstallations(token, {
      fetch: deps.fetch,
    });
    const installation = installations.find((i) => i.id === installationId);
    if (!installation) {
      res.redirect(back("not-found"));
      return;
    }
    await recordInstallation(deps.db, {
      installationId,
      accountLogin: installation.accountLogin,
      accountType: installation.accountType,
      installedByUserId: userId,
    });
    res.redirect(back("installed"));
  };
}
