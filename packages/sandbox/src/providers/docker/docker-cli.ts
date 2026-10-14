import {
  runProcess,
  type RunProcessOptions,
  type RunProcessResult,
} from "../../lib/run-process.js";
import { DOCKER_CALL_TIMEOUT_MS } from "./constants.js";

/** Runs the docker CLI with a default timeout. */
export function docker(args: string[], options?: RunProcessOptions) {
  return runProcess("docker", args, {
    timeoutMs: DOCKER_CALL_TIMEOUT_MS,
    ...options,
  });
}

/** Error text produced by the docker CLI/daemon itself (not by the command we ran). */
export function isContainerGone(result: RunProcessResult) {
  return (
    result.code !== 0 &&
    /Error response from daemon: (No such container|Container .* is not running)/.test(
      result.stderr,
    )
  );
}
