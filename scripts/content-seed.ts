// pnpm content:seed [dir]. Validates, then upserts into DATABASE_URL. Silent on success.
import { join, resolve } from "node:path";
import pg from "pg";
import { seedContent } from "./lib/content/seed.ts";
import { readPublished, validateContent } from "./lib/content/validate.ts";

const dir = resolve(process.argv[2] ?? "content");
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("content:seed: DATABASE_URL is not set");
  process.exit(1);
}
const { content, errors } = validateContent(
  dir,
  readPublished(process.env.PUBLISHED_IDS_FILE ?? join(dir, "published-ids.json")),
);
if (errors.length > 0) {
  console.log(errors.map((e) => `✗ ${e}`).join("\n"));
  console.log("content:seed: refusing to seed invalid content");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await seedContent(client, content);
} finally {
  await client.end();
}
