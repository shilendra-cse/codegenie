import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests start real containers.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
