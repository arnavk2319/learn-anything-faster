import { defineConfig } from "vitest/config";

// Unit tests only. Integration, security and tool suites have their own configs.
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
