import { cp } from "node:fs/promises";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", migrate: "src/scripts/migrate.ts" },
  format: "esm",
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  // Our packages ship TypeScript, so they're bundled; npm packages load from node_modules.
  skipNodeModulesBundle: true,
  noExternal: [/^@hobai\//],
  onSuccess: () =>
    cp("../../packages/db/drizzle", "dist/drizzle", { recursive: true }),
});
