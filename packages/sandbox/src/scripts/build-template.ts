import path from "node:path";
import { Template } from "e2b";
import { DEFAULT_TEMPLATE } from "../providers/e2b/constants.js";
import { E2BSandbox } from "../providers/e2b/e2b-sandbox.js";

const DOCKERFILE = path.join(
  import.meta.dirname,
  "..",
  "..",
  "images",
  "base",
  "Dockerfile",
);
// Same CPUs and memory as a Docker sandbox.
const RESOURCES = { cpuCount: 2, memoryMB: 4096 };

const CHECK = [
  "whoami",
  "pwd",
  "touch /workspace/.check && rm /workspace/.check && echo /workspace is writable",
  // E2B skips the Dockerfile's ENV; the sandbox sets it instead.
  'test "$CI" = true && test "$COREPACK_ENABLE_DOWNLOAD_PROMPT" = 0 && echo CI and corepack are set',
  "node --version",
  "pnpm --version",
  "rg --version | head -n 1",
  "fd --version",
  "git config user.name",
].join(" && ");

const apiKey = process.env.E2B_API_KEY;

async function build(replace: boolean) {
  if (!replace && (await Template.exists(DEFAULT_TEMPLATE, { apiKey }))) {
    console.log(
      `Template ${DEFAULT_TEMPLATE} already exists; --replace rebuilds it.`,
    );
    return;
  }
  console.log(`Building ${DEFAULT_TEMPLATE} from ${DOCKERFILE}…`);
  const info = await Template.build(
    Template().fromDockerfile(DOCKERFILE),
    DEFAULT_TEMPLATE,
    {
      ...RESOURCES,
      apiKey,
      skipCache: replace,
      onBuildLogs: (entry) => console.log(entry.message.trimEnd()),
    },
  );
  console.log(`Template ${info.name} is built (${info.templateId}).`);
}

async function check() {
  console.log("\nChecking a sandbox made from it…");
  const sandbox = await E2BSandbox.create({
    apiKey,
    labels: { kind: "template-check" },
  });
  try {
    const result = await sandbox.exec(CHECK);
    console.log(result.stdout.trimEnd());
    if (result.exitCode !== 0) {
      console.error(result.stderr.trimEnd());
      throw new Error(`The check failed with exit code ${result.exitCode}.`);
    }
  } finally {
    await sandbox.destroy();
  }
}

async function main() {
  await build(process.argv.includes("--replace"));
  await check();
  console.log("\nReady: SANDBOX_PROVIDER=e2b can use it.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
