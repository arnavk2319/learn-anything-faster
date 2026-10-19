// Fetch each resource URL in content/resources/*.yaml: require 2xx and a page title that shares a word with
// the recorded title. Prints failures only; exit 1 if any. Dropping failed entries is left to the caller.
// node scripts/verify-urls.ts [file.yaml ...]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { root } from "./lib/budget.ts";

interface Res {
  url?: string;
  title?: string;
}

const dir = join(root(), "content", "resources");
const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : (() => {
        try {
          return readdirSync(dir)
            .filter((f) => f.endsWith(".yaml"))
            .map((f) => join(dir, f));
        } catch {
          return [];
        }
      })();

const words = (s: string): Set<string> => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
let bad = 0;
let total = 0;

for (const f of files) {
  const items = (parse(readFileSync(f, "utf8")) ?? []) as Res[];
  for (const r of items) {
    if (!r.url) continue;
    total++;
    try {
      const res = await fetch(r.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: { "user-agent": "laf-link-check/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = (await res.text()).slice(0, 200_000);
      const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
      const want = words(r.title ?? "");
      const got = words(title);
      if (want.size > 0 && ![...want].some((w) => got.has(w)))
        throw new Error(`title mismatch: "${title.trim().slice(0, 80)}"`);
    } catch (e) {
      bad++;
      console.log(`✗ ${f.replace(root() + "/", "")}: ${r.url} (${(e as Error).message})`);
    }
  }
}
console.log(`verify-urls: ${total - bad}/${total} ok`);
process.exit(bad > 0 ? 1 : 0);
