import path from "node:path";
import { Daytona, DaytonaNotFoundError, Image } from "@daytonaio/sdk";
import { DEFAULT_SNAPSHOT } from "../providers/daytona/constants.js";
import { DaytonaSandbox } from "../providers/daytona/daytona-sandbox.js";

const DOCKERFILE = path.join(
  import.meta.dirname,
  "..",
  "..",
  "images",
  "base",
  "Dockerfile",
);
// Same CPUs and memory as a Docker sandbox; disk for node_modules and builds.
const RESOURCES = { cpu: 2, memory: 4, disk: 10 };

const CHECK = [
  "whoami",
  "pwd",
  "touch /workspace/.check && rm /workspace/.check && echo /workspace is writable",
  "node --version",
  "pnpm --version",
  "rg --version | head -n 1",
  "fd --version",
  "git config user.name",
].join(" && ");

const connection = {
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
  target: process.env.DAYTONA_TARGET,
};

async function snapshotState(daytona: Daytona) {
  try {
    return (await daytona.snapshot.get(DEFAULT_SNAPSHOT)).state;
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) return null;
    throw error;
  }
}

async function build(daytona: Daytona, replace: boolean) {
  const state = await snapshotState(daytona);
  if (state && !replace) {
    console.log(
      `Snapshot ${DEFAULT_SNAPSHOT} already exists (${state}); --replace rebuilds it.`,
    );
    return;
  }
  if (state) {
    console.log(`Deleting snapshot ${DEFAULT_SNAPSHOT}…`);
    await daytona.snapshot.delete(DEFAULT_SNAPSHOT);
  }
  console.log(`Building ${DEFAULT_SNAPSHOT} from ${DOCKERFILE}…`);
  const snapshot = await daytona.snapshot.create(
    {
      name: DEFAULT_SNAPSHOT,
      image: Image.fromDockerfile(DOCKERFILE),
      resources: RESOURCES,
    },
    { onLogs: (line) => console.log(line.trimEnd()) },
  );
  console.log(`Snapshot ${snapshot.name} is ${snapshot.state}.`);
}

async function check() {
  console.log("\nChecking a sandbox made from it…");
  const sandbox = await DaytonaSandbox.create({
    ...connection,
    labels: { kind: "snapshot-check" },
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
  const daytona = new Daytona(connection);
  await build(daytona, process.argv.includes("--replace"));
  await check();
  console.log("\nReady: SANDBOX_PROVIDER=daytona can use it.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
