import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // fixtures/ and tasks/ hold the eval repos' own tests (node:test), not the harness's.
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
