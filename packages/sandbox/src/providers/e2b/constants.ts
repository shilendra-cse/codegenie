import { SHORT_NAME } from "@hobai/shared/brand";

export const DEFAULT_TEMPLATE = `${SHORT_NAME}-base`;
export const SANDBOX_METADATA = { [SHORT_NAME]: "1" };

// E2B doesn't apply the Dockerfile's ENV to commands, so the sandbox sets it.
export const SANDBOX_ENV = {
  CI: "true",
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
};

// The longest E2B allows on the Hobby plan; runs and setups end within 45 minutes.
export const LIFETIME_MS = 60 * 60_000;
export const CREATE_TIMEOUT_MS = 180_000;
export const FILE_TIMEOUT_MS = 120_000;
export const SDK_TIMEOUT_MARGIN_MS = 15_000;
