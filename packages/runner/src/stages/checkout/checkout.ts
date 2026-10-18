import { DockerSandbox, type Sandbox } from "@codegenie/sandbox";
import { shellQuote } from "../../lib/shell-quote.js";
import { listLocalFiles } from "./local-files.js";

export type RepoSource =
  | { type: "local"; path: string }
  | { type: "git"; url: string; ref?: string };

export type CheckoutResult = {
  description: string;
  files: number | null;
};

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

const CLONE_TIMEOUT_MS = 5 * 60_000;

export async function checkoutRepo(
  sandbox: Sandbox,
  source: RepoSource,
): Promise<CheckoutResult> {
  if (source.type === "git") {
    const branch = source.ref ? `--branch ${shellQuote(source.ref)} ` : "";
    const clone = await sandbox.exec(
      `git clone --quiet --depth 1 ${branch}${shellQuote(source.url)} .`,
      { timeoutMs: CLONE_TIMEOUT_MS },
    );
    if (clone.exitCode !== 0) {
      throw new CheckoutError(
        `git clone failed: ${clone.stderr.trim() || `exit code ${clone.exitCode}`}`,
      );
    }
    return {
      description: source.ref ? `${source.url} (${source.ref})` : source.url,
      files: null,
    };
  }

  if (!(sandbox instanceof DockerSandbox)) {
    throw new CheckoutError(
      "Local folders can only be copied into a Docker sandbox.",
    );
  }
  const files = await listLocalFiles(source.path);
  if (files.length === 0) {
    throw new CheckoutError(`No files to copy from ${source.path}.`);
  }
  await sandbox.copyInFiles(source.path, files);
  return { description: source.path, files: files.length };
}

export async function headCommit(sandbox: Sandbox) {
  const head = await sandbox.exec("git rev-parse HEAD");
  return head.exitCode === 0 ? head.stdout.trim() : undefined;
}
