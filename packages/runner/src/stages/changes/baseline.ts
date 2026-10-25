import type { Sandbox } from "@hobai/sandbox";
import { SHORT_NAME } from "@hobai/shared/brand";

const BASELINE_MESSAGE = `${SHORT_NAME}: baseline`;

export async function createBaseline(sandbox: Sandbox): Promise<string> {
  const result = await sandbox.exec(
    [
      "[ -d .git ] || git init -q",
      "mkdir -p .git/info && echo node_modules/ >> .git/info/exclude",
      "git add -A",
      `git commit -q --allow-empty --no-verify -m "${BASELINE_MESSAGE}"`,
      "git rev-parse HEAD",
    ].join(" && "),
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `Could not create the baseline commit: ${result.stderr.trim()}`,
    );
  }
  return result.stdout.trim();
}

export async function findBaseline(sandbox: Sandbox): Promise<string | null> {
  const result = await sandbox.exec(
    `git log -1 --format=%H --fixed-strings --grep="${BASELINE_MESSAGE}"`,
  );
  const sha = result.stdout.trim();
  return result.exitCode === 0 && sha ? sha : null;
}
