// Applies drizzle up migrations (the .down.sql siblings are ignored: they are not in the journal).
// Uses the unpooled URL when set. Usage: pnpm db:migrate
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL_UNPOOLED or DATABASE_URL");
const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), {
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
  });
  console.log("migrations applied");
} finally {
  await pool.end();
}
