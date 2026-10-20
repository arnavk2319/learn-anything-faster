// The only place a DB driver is imported. Local/CI/tests use node-postgres; Vercel sets DB_DRIVER=neon.
import * as schema from "./schema";

export async function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (process.env.DB_DRIVER === "neon") {
    const [{ drizzle }, { Pool }] = await Promise.all([
      import("drizzle-orm/neon-serverless"),
      import("@neondatabase/serverless"),
    ]);
    return drizzle(new Pool({ connectionString: url }), { schema });
  }
  const [{ drizzle }, { default: pg }] = await Promise.all([
    import("drizzle-orm/node-postgres"),
    import("pg"),
  ]);
  return drizzle(new pg.Pool({ connectionString: url }), { schema });
}
