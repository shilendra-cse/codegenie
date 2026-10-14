import type { CreateSandboxOptions, Sandbox } from "./core/types.js";
import { DockerSandbox } from "./providers/docker/docker-sandbox.js";

/** Creates a sandbox from the configured provider. Phase 2 adds "daytona". */
export async function createSandbox(
  options: CreateSandboxOptions,
): Promise<Sandbox> {
  switch (options.provider) {
    case "docker":
      return DockerSandbox.create({ resources: options.resources });
  }
}
