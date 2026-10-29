import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@laf/graph": fileURLToPath(new URL("packages/graph/src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 40_000,
    globalSetup: ["tests/integration/global-setup.ts"],
  },
});
