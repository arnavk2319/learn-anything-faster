import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["tests/data/**/*.test.ts"], testTimeout: 30_000 },
});
