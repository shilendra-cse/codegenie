export const DEFAULT_IMAGE = "codegenie-base";
/** Every sandbox container carries this label so leftovers can be found (pnpm sandbox:clean). */
export const SANDBOX_LABEL = "codegenie=1";

export const DEFAULT_CPUS = 2;
export const DEFAULT_MEMORY_GB = 4;
export const PIDS_LIMIT = 512;
/** Containers exit by themselves after this long, even if destroy() is never called. */
export const MAX_LIFETIME_SECONDS = 2 * 60 * 60;

export const DEFAULT_EXEC_TIMEOUT_MS = 2 * 60_000;
export const MAX_EXEC_TIMEOUT_MS = 10 * 60_000;
/** Grace period for `timeout -k` to SIGKILL a command that ignores SIGTERM. */
export const KILL_GRACE_SECONDS = 5;
/** Host-side backstop beyond the in-container timeout, in case the docker CLI itself hangs. */
export const HOST_TIMEOUT_MARGIN_MS = 15_000;

/** Timeout for docker housekeeping calls (create, inspect, rm, file ops). */
export const DOCKER_CALL_TIMEOUT_MS = 60_000;
/** Timeout for copying a local directory into a container. */
export const COPY_IN_TIMEOUT_MS = 5 * 60_000;
/** readFile refuses files larger than this rather than returning them truncated. */
export const MAX_READ_FILE_BYTES = 10 * 1024 * 1024;
