import type {
  ConnectSandboxOptions,
  CreateSandboxOptions,
  Sandbox,
} from "./core/types.js";
import { DaytonaSandbox } from "./providers/daytona/daytona-sandbox.js";
import { DockerSandbox } from "./providers/docker/docker-sandbox.js";
import { E2BSandbox } from "./providers/e2b/e2b-sandbox.js";

export async function createSandbox(
  options: CreateSandboxOptions,
): Promise<Sandbox> {
  switch (options.provider) {
    case "docker":
      return DockerSandbox.create({
        resources: options.resources,
        labels: options.labels,
      });
    case "daytona":
      return DaytonaSandbox.create({
        ...options.connection,
        labels: options.labels,
        retentionHours: options.retentionHours,
      });
    case "e2b":
      return E2BSandbox.create({
        ...options.connection,
        labels: options.labels,
      });
  }
}

export async function connectSandbox(
  options: ConnectSandboxOptions,
): Promise<Sandbox | null> {
  switch (options.provider) {
    case "docker":
      return DockerSandbox.connect(options.id);
    case "daytona":
      return DaytonaSandbox.connect(options.id, options.connection);
    case "e2b":
      return E2BSandbox.connect(options.id, options.connection);
  }
}

export async function parkSandbox(sandbox: Sandbox): Promise<void> {
  if (sandbox instanceof DaytonaSandbox) {
    await sandbox.stop();
    return;
  }
  // A stopped Docker container or paused E2B sandbox never expires, so it's deleted instead.
  await sandbox.destroy();
}
