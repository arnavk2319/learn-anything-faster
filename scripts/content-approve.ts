// pnpm tsx scripts/content-approve.ts --topics a,b|all [--roles x,y] [--dir content]
// Human-triggered only (see .github/workflows/content-approve.yml). Flips resources of the
// given topics proposed -> approved and the given roles coming_soon -> live. Line edits keep formatting.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const list = (v: string | undefined): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const dir = resolve(arg("dir") ?? "content");
const topics = list(arg("topics"));
const roles = list(arg("roles"));
if (topics.length === 0 && roles.length === 0) {
  console.log("content-approve: pass --topics and/or --roles");
  process.exit(1);
}
const all = topics.includes("all");

let resourcesApproved = 0;
for (const f of readdirSync(join(dir, "resources")).filter((n) => n.endsWith(".yaml"))) {
  const path = join(dir, "resources", f);
  const text = readFileSync(path, "utf8");
  const topic = /^topic:\s*(\S+)/m.exec(text)?.[1];
  if (!topic || !(all || topics.includes(topic))) continue;
  const out = text.replace(/^(\s+status:\s*)proposed\s*$/gm, (_m, head: string) => {
    resourcesApproved++;
    return `${head}approved`;
  });
  if (out !== text) writeFileSync(path, out);
}

let rolesLive = 0;
if (roles.length > 0) {
  const path = join(dir, "roles.yaml");
  const lines = readFileSync(path, "utf8").split("\n");
  let current = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const id = /^- id:\s*(\S+)/.exec(line)?.[1];
    if (id) current = id;
    if (roles.includes(current) && /^\s+status:\s*coming_soon\s*$/.test(line)) {
      lines[i] = line.replace("coming_soon", "live");
      rolesLive++;
    }
  }
  writeFileSync(path, lines.join("\n"));
}
console.log(`content-approve: ${resourcesApproved} resources approved, ${rolesLive} roles live`);
