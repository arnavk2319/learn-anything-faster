// pnpm content:validate [dir]. Prints failures only; exit 1 on any. No content dir = nothing to check.
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { readPublished, validateContent } from "./lib/content/validate.ts";

const dir = resolve(process.argv[2] ?? "content");
if (existsSync(dir)) {
  const published = readPublished(
    process.env.PUBLISHED_IDS_FILE ?? join(dir, "published-ids.json"),
  );
  const { errors } = validateContent(dir, published);
  if (errors.length > 0) {
    console.log(errors.map((e) => `✗ ${e}`).join("\n"));
    console.log(`content:validate: ${errors.length} error(s)`);
    process.exit(1);
  }
}
