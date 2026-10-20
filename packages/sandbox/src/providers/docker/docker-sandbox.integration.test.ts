import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SandboxFileError,
  SandboxGoneError,
  SandboxUnavailableError,
} from "../../core/errors.js";
import { runProcess } from "../../lib/run-process.js";
import { DEFAULT_IMAGE } from "./constants.js";
import { DockerSandbox } from "./docker-sandbox.js";

async function dockerReady(): Promise<string | null> {
  try {
    const version = await runProcess("docker", ["version"]);
    if (version.code !== 0) return "Docker is not running";
    const image = await runProcess("docker", [
      "image",
      "inspect",
      DEFAULT_IMAGE,
    ]);
    if (image.code !== 0)
      return `image ${DEFAULT_IMAGE} not built (pnpm sandbox:build-image)`;
    return null;
  } catch {
    return "Docker CLI not installed";
  }
}

const notReady = await dockerReady();
if (notReady && process.env.CI) {
  throw new Error(
    `Sandbox integration tests require Docker in CI: ${notReady}`,
  );
}
if (notReady) {
  console.warn(`Skipping DockerSandbox integration tests: ${notReady}`);
}

async function containerExists(id: string) {
  const r = await runProcess("docker", ["inspect", id]);
  return r.code === 0;
}

describe.skipIf(notReady)("DockerSandbox", () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    sandbox = await DockerSandbox.create({
      labels: { kind: "run", runId: "r-test" },
    });
  });

  afterAll(async () => {
    await sandbox?.destroy();
  });

  it("labels the container for the reaper", async () => {
    const r = await runProcess("docker", [
      "inspect",
      "--format",
      "{{json .Config.Labels}}",
      sandbox.id,
    ]);
    expect(JSON.parse(r.stdout)).toMatchObject({
      codegenie: "1",
      kind: "run",
      runId: "r-test",
    });
  });

  describe("exec", () => {
    it("runs a command and returns stdout and exit code", async () => {
      const r = await sandbox.exec("echo hi");
      expect(r).toMatchObject({ exitCode: 0, stdout: "hi\n", timedOut: false });
    });

    it("returns a non-zero exit code as a result, not an error", async () => {
      const r = await sandbox.exec("exit 3");
      expect(r.exitCode).toBe(3);
    });

    it("captures stderr separately", async () => {
      const r = await sandbox.exec("echo out; echo err >&2");
      expect(r.stdout).toBe("out\n");
      expect(r.stderr).toBe("err\n");
    });

    it("defaults to /workspace and respects cwd and env", async () => {
      expect((await sandbox.exec("pwd")).stdout).toBe("/workspace\n");
      await sandbox.exec("mkdir -p sub");
      const r = await sandbox.exec('pwd; echo "$GREETING"', {
        cwd: "sub",
        env: { GREETING: "hello there" },
      });
      expect(r.stdout).toBe("/workspace/sub\nhello there\n");
    });

    it("runs as the non-root agent user", async () => {
      expect((await sandbox.exec("whoami")).stdout).toBe("agent\n");
    });

    it("has the expected toolchain", async () => {
      const r = await sandbox.exec(
        "node -v && git --version && rg --version && fd --version && pnpm --version",
      );
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/^v24\./);
    });

    it("times out and kills the process inside the container", async () => {
      const started = Date.now();
      const r = await sandbox.exec("sleep 30", { timeoutMs: 1000 });
      expect(r.timedOut).toBe(true);
      expect(Date.now() - started).toBeLessThan(10_000);
      const ps = await sandbox.exec("ps -eo args");
      expect(ps.stdout).not.toMatch(/sleep 30/);
    });

    it("caps output at 1 MB, keeping head and tail", async () => {
      const r = await sandbox.exec(
        "echo START; head -c 3000000 /dev/zero | tr '\\0' 'x'; echo; echo END",
      );
      expect(r.truncated).toBe(true);
      expect(r.stdout.startsWith("START\n")).toBe(true);
      expect(r.stdout.trimEnd().endsWith("END")).toBe(true);
      expect(r.stdout).toMatch(/bytes omitted/);
      expect(r.stdout.length).toBeLessThan(1_100_000);
    });
  });

  describe("files", () => {
    it("round-trips awkward content byte for byte without executing it", async () => {
      const content =
        "quotes \" ' and $HOME and `whoami` and $(touch /workspace/pwned)\n" +
        "'; rm -rf /workspace; echo '\n" +
        "unicode: héllo — 日本語 🚀\n\n";
      await sandbox.writeFile("awkward.txt", content);
      expect(await sandbox.readFile("awkward.txt")).toBe(content);
      expect(await sandbox.readFile("/workspace/awkward.txt")).toBe(content);
      const pwned = await sandbox.exec("test -e pwned");
      expect(pwned.exitCode).not.toBe(0);
    });

    it("creates missing parent directories on write", async () => {
      await sandbox.writeFile("deep/nested/dir/file.ts", "export {};\n");
      expect(await sandbox.readFile("deep/nested/dir/file.ts")).toBe(
        "export {};\n",
      );
    });

    it("throws SandboxFileError for a missing file", async () => {
      await expect(
        sandbox.readFile("does-not-exist.txt"),
      ).rejects.toBeInstanceOf(SandboxFileError);
    });

    it("lists files with depth limit, skipping node_modules and .git", async () => {
      await sandbox.exec(
        "rm -rf list && mkdir -p list/a/b/c list/node_modules/pkg list/.git && " +
          "echo 12345 > list/a/file.txt && touch list/node_modules/pkg/index.js list/a/b/c/deep.txt",
      );
      const entries = await sandbox.listFiles("list", { maxDepth: 2 });
      const paths = entries.map((e) => e.path);
      expect(paths).toEqual([
        "/workspace/list/a",
        "/workspace/list/a/b",
        "/workspace/list/a/file.txt",
      ]);
      expect(entries.find((e) => e.path.endsWith("/a"))?.isDirectory).toBe(
        true,
      );
      expect(entries.find((e) => e.path.endsWith("file.txt"))?.size).toBe(6);
    });
  });

  it("copies a local directory in, writable by the agent user", async () => {
    const local = mkdtempSync(path.join(tmpdir(), "cg-copyin-"));
    try {
      writeFileSync(path.join(local, "hello.txt"), "from host\n");
      await sandbox.copyIn(local);
      expect(await sandbox.readFile("hello.txt")).toBe("from host\n");
      await sandbox.writeFile("hello.txt", "edited in sandbox\n");
      expect(await sandbox.readFile("hello.txt")).toBe("edited in sandbox\n");
    } finally {
      rmSync(local, { recursive: true, force: true });
    }
  });
});

describe.skipIf(notReady)("DockerSandbox lifecycle", () => {
  it("destroy removes the container, is idempotent, and later calls throw SandboxGoneError", async () => {
    const sandbox = await DockerSandbox.create();
    expect(await containerExists(sandbox.id)).toBe(true);
    await sandbox.destroy();
    await sandbox.destroy();
    expect(await containerExists(sandbox.id)).toBe(false);
    await expect(sandbox.exec("echo hi")).rejects.toBeInstanceOf(
      SandboxGoneError,
    );
  });

  it("detects a container removed outside of destroy()", async () => {
    const sandbox = await DockerSandbox.create();
    await runProcess("docker", ["rm", "-f", sandbox.id]);
    await expect(sandbox.exec("echo hi")).rejects.toBeInstanceOf(
      SandboxGoneError,
    );
  });

  it("reports a missing image with a build hint", async () => {
    await expect(
      DockerSandbox.create({ image: "codegenie-image-that-does-not-exist" }),
    ).rejects.toThrow(SandboxUnavailableError);
    await expect(
      DockerSandbox.create({ image: "codegenie-image-that-does-not-exist" }),
    ).rejects.toThrow(/pnpm sandbox:build-image/);
  });
});
