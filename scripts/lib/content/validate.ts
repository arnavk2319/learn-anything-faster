import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { checkContent, type PublishedIds } from "./check.ts";
import { loadContent, type Content } from "./load.ts";

const PublishedSchema = z.strictObject({
  topics: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
});

export function readPublished(file: string | undefined): PublishedIds {
  if (!file || !existsSync(file)) return {};
  return PublishedSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

/** Loads and fully validates a content dir. Returns content plus every error (empty = valid). */
export function validateContent(
  dir: string,
  published: PublishedIds = {},
): { content: Content; errors: string[] } {
  const loaded = loadContent(dir);
  // Cross-file checks on partially loaded content would only add noise after a schema error.
  const errors = loaded.errors.length > 0 ? loaded.errors : checkContent(loaded.content, published);
  return { content: loaded.content, errors };
}
