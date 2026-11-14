import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${port}`,
    trace: "on",
    video: "on",
    screenshot: "on",
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm dev --port ${port}`,
        url: `http://localhost:${port}`,
        reuseExistingServer: true,
        env: {
          DATABASE_URL:
            process.env.DATABASE_URL_TEST ??
            "postgres://postgres:postgres@localhost:54329/laf_test",
          FORM_RATE_LIMIT: "1000",
          // Learn pages only build approved content; e2e uses approved copies of the T-037 sample (T-045).
          LEARN_CONTENT_DIR: fileURLToPath(new URL("./e2e/fixtures/learn", import.meta.url)),
        },
      },
});
