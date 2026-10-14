// Sandbox abstraction the agent's tools run against (docs/knowledge/sandbox.md).
export * from "./core/types.js";
export * from "./core/errors.js";
export { createSandbox } from "./create-sandbox.js";
export {
  DockerSandbox,
  type DockerSandboxOptions,
} from "./providers/docker/docker-sandbox.js";
export { DEFAULT_IMAGE, SANDBOX_LABEL } from "./providers/docker/constants.js";
