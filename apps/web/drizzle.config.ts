import { defineConfig } from "drizzle-kit";

// Schema lands in T-004. Never run drizzle-kit push against a non-local database.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
