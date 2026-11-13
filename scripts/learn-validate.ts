// pnpm learn:validate [dir]. Loads content/learn from disk, validates every track pack, prints the gap ratio.
// Exit 1 on any error. No content/learn dir = nothing to check.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import { validateLearn } from "./lib/learn/validate.ts";

const root = resolve(process.argv[2] ?? "content/learn");
const readYaml = (f: string): unknown => parse(readFileSync(f, "utf8"));
const yamlFiles = (d: string) =>
  existsSync(d)
    ? readdirSync(d)
        .filter((f) => f.endsWith(".yaml"))
        .sort()
        .map((f) => join(d, f))
    : [];
const readJsonList = (f: string): string[] =>
  existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as string[]) : [];

function knownTopicIds(): string[] {
  const dir = resolve(root, "../topics");
  return yamlFiles(dir).flatMap((f) => {
    const doc = readYaml(f) as { topics?: { id: string }[] } | null;
    return (doc?.topics ?? []).map((t) => t.id);
  });
}

// T-037 sample packs predate ADR-0015 rev 4: sim blocks use `sim: {ref}` and faq blocks carry one block-level `src`.
// Map those two shapes to the rev 4 shape here (the schema stays strict) and warn until the content is migrated.
let legacy = 0;
function upgradeLegacy(doc: unknown): unknown {
  if (Array.isArray(doc)) return doc.map(upgradeLegacy);
  if (doc === null || typeof doc !== "object") return doc;
  const o = { ...(doc as Record<string, unknown>) };
  if (
    o.type === "sim" &&
    o.ref === undefined &&
    typeof (o.sim as { ref?: unknown } | undefined)?.ref === "string"
  ) {
    o.ref = (o.sim as { ref: string }).ref;
    delete o.sim;
    legacy++;
  }
  if (o.type === "faq" && o.src !== undefined && Array.isArray(o.items)) {
    const src = o.src;
    o.items = (o.items as Record<string, unknown>[]).map((it) => ({ src, ...it }));
    delete o.src;
    legacy++;
  }
  for (const [k, v] of Object.entries(o)) o[k] = upgradeLegacy(v);
  return o;
}

function loadPack(track: string) {
  const dir = join(root, track);
  const trackFile = join(dir, "track.yaml");
  // track.yaml is optional until the pilot content ticket adds it; a stub keeps the checks running.
  const trackDoc = existsSync(trackFile)
    ? readYaml(trackFile)
    : {
        id: track,
        title: track,
        summary: "Track metadata not yet authored.",
        category: "engineering",
        status: "live",
        order: 0,
      };
  const guidesDir = join(root, "_guides");
  const guides: Record<string, string> = {};
  for (const f of existsSync(guidesDir) ? readdirSync(guidesDir) : [])
    if (f.endsWith(".md")) guides[f.slice(0, -3)] = readFileSync(join(guidesDir, f), "utf8");
  const dlFile = join(root, "denylist.json");
  const denylist = existsSync(dlFile)
    ? (JSON.parse(readFileSync(dlFile, "utf8")) as { terms?: string[]; hashes?: string[] })
    : {};
  return {
    track: trackDoc,
    concepts: yamlFiles(join(dir, "concepts")).map(readYaml).map(upgradeLegacy),
    problems: yamlFiles(join(dir, "problems")).map(readYaml).map(upgradeLegacy),
    questions: yamlFiles(join(dir, "questions")).flatMap(
      (f) => (readYaml(f) as unknown[] | null) ?? [],
    ),
    sets: yamlFiles(join(dir, "sets")).map(readYaml),
    sims: yamlFiles(join(dir, "sims")).map(readYaml),
    guides,
    previousApprovedIds: readJsonList(join(dir, "published-ids.json")),
    denylist: { terms: denylist.terms ?? [], hashes: denylist.hashes ?? [] },
    knownTopicIds: knownTopicIds(),
  };
}

let failed = 0;
if (existsSync(root)) {
  const tracks = readdirSync(root).filter(
    (d) => !d.startsWith("_") && statSync(join(root, d)).isDirectory(),
  );
  for (const t of tracks) {
    const res = validateLearn(loadPack(t));
    console.log(`[${t}] ${res.report}`);
    for (const e of res.errors) console.log(`✗ [${t}] ${e.rule}: ${e.message}`);
    failed += res.errors.length;
  }
}
if (legacy > 0)
  console.log(
    `learn:validate: warning: ${legacy} legacy block shape(s) (sim block "sim: {ref}", faq block-level src) auto-mapped; migrate the content to ADR-0015 rev 4`,
  );
if (failed > 0) {
  console.log(`learn:validate: ${failed} error(s)`);
  process.exit(1);
}
