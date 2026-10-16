import type { Sandbox } from "@codegenie/sandbox";

export async function createBaseline(sandbox: Sandbox): Promise<string> {
  const result = await sandbox.exec(
    [
      "[ -d .git ] || git init -q",
      "mkdir -p .git/info && echo node_modules/ >> .git/info/exclude",
      "git add -A",
      'git commit -q --allow-empty --no-verify -m "codegenie: baseline"',
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
