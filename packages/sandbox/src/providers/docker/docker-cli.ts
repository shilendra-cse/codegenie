import {
  runProcess,
  type RunProcessOptions,
  type RunProcessResult,
} from "../../lib/run-process.js";
import { DOCKER_CALL_TIMEOUT_MS } from "./constants.js";

export function docker(args: string[], options?: RunProcessOptions) {
  return runProcess("docker", args, {
    timeoutMs: DOCKER_CALL_TIMEOUT_MS,
    ...options,
  });
}

export function isContainerGone(result: RunProcessResult) {
  return (
    result.code !== 0 &&
    /Error response from daemon: (No such container|Container .* is not running)/.test(
      result.stderr,
    )
  );
}
