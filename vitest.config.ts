import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Unit tests only. Integration, security and tool suites have their own configs.
export default defineConfig({
  resolve: {
    // Mirrors apps/web/tsconfig.json paths: "@/lib/brand" is the repo-root brand file, "@/" is apps/web.
    alias: [
      { find: /^@\/lib\/brand$/, replacement: root("./lib/brand.ts") },
      { find: /^@\//, replacement: root("./apps/web/") },
    ],
  },
  // apps/web tsconfig sets jsx "preserve" for Next; tests need the automatic runtime.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
