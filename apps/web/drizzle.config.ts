import { defineConfig } from "drizzle-kit";

// Run from the repo root (pnpm db:generate). Only `generate` is used; migrations are applied by db/migrate.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./apps/web/db/schema.ts",
  out: "./apps/web/db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
