// Server-only loader for Learn packs (ADR-0015 sections 1 and 4). Reads content/learn from disk (or
// LEARN_CONTENT_DIR, used by e2e fixtures). Only `approved` items are ever returned: proposed packs are
// never built or served. A file that fails its schema is skipped (pnpm learn:validate fails CI on it).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { cache } from "react";
import {
  ConceptSchema,
  ProblemSchema,
  QuestionSchema,
  SimSchema,
  TrackSchema,
  type Concept,
  type Problem,
  type Question,
  type Sim,
  type Track,
} from "./schemas";
import { upgradeLegacy } from "./legacy";
import { resolveSimRef, type SimRefInput } from "./sim/templates";

export function contentRoot(): string {
  const env = process.env.LEARN_CONTENT_DIR?.trim();
  if (env) return resolve(env);
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "content", "learn");
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return resolve(process.cwd(), "content", "learn");
}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const isSafeId = (s: string): boolean => SAFE_ID.test(s);

function yamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml"))
    .sort()
    .map((f) => join(dir, f));
}

function readYaml(file: string): unknown {
  try {
    return parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export interface TrackPack {
  track: Track;
  concepts: Concept[];
  problems: Problem[];
  /** Approved, non-retired questions by id. */
  questions: Map<string, Question>;
  sims: Sim[];
}

/** "system-design" -> "System design": the title used until a track.yaml authors one. */
export function titleFromId(id: string): string {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function readTrackDoc(trackId: string, dir: string): unknown {
  const trackFile = join(dir, "track.yaml");
  // track.yaml is optional until the pilot content ticket adds it (same stub as learn:validate).
  return existsSync(trackFile)
    ? readYaml(trackFile)
    : {
        id: trackId,
        title: titleFromId(trackId),
        summary: "Track metadata not yet authored.",
        category: "engineering",
        status: "live",
        order: 0,
      };
}

/** Track metadata for any status (live or coming-soon), or null when absent or invalid. */
export const loadTrackMeta = cache((trackId: string): Track | null => {
  if (!isSafeId(trackId)) return null;
  const dir = join(contentRoot(), trackId);
  if (!existsSync(dir)) return null;
  const r = TrackSchema.safeParse(readTrackDoc(trackId, dir));
  return r.success && r.data.id === trackId ? r.data : null;
});

/** Loads one track's approved content, or null when the track does not exist or is not live. */
export const loadTrack = cache((trackId: string): TrackPack | null => {
  if (!isSafeId(trackId)) return null;
  const dir = join(contentRoot(), trackId);
  if (!existsSync(dir)) return null;
  const track = TrackSchema.safeParse(readTrackDoc(trackId, dir));
  if (!track.success || track.data.id !== trackId || track.data.status !== "live") return null;

  const concepts: Concept[] = [];
  for (const f of yamlFiles(join(dir, "concepts"))) {
    const r = ConceptSchema.safeParse(upgradeLegacy(readYaml(f)));
    if (r.success && r.data.status === "approved" && r.data.trackId === trackId)
      concepts.push(r.data);
  }
  const problems: Problem[] = [];
  for (const f of yamlFiles(join(dir, "problems"))) {
    const r = ProblemSchema.safeParse(upgradeLegacy(readYaml(f)));
    if (r.success && r.data.status === "approved" && r.data.trackId === trackId)
      problems.push(r.data);
  }
  const questions = new Map<string, Question>();
  for (const f of yamlFiles(join(dir, "questions"))) {
    const list = readYaml(f);
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const r = QuestionSchema.safeParse(raw);
      if (r.success && r.data.status === "approved" && !r.data.retired)
        questions.set(r.data.id, r.data);
    }
  }
  const sims: Sim[] = [];
  for (const f of yamlFiles(join(dir, "sims"))) {
    const r = SimSchema.safeParse(readYaml(f));
    if (r.success) sims.push(r.data);
  }
  concepts.sort((a, b) => a.order - b.order);
  return { track: track.data, concepts, problems, questions, sims };
});

export function listApprovedIds(): { track: string; kind: "concepts" | "problems"; id: string }[] {
  const base = contentRoot();
  if (!existsSync(base)) return [];
  const out: { track: string; kind: "concepts" | "problems"; id: string }[] = [];
  for (const t of readdirSync(base)) {
    if (t.startsWith("_")) continue;
    const pack = loadTrack(t);
    if (!pack) continue;
    for (const c of pack.concepts) out.push({ track: t, kind: "concepts", id: c.id });
    for (const p of pack.problems) out.push({ track: t, kind: "problems", id: p.id });
  }
  return out;
}

/** Questions of an owner (concept or problem) in the order of its quiz block ids, approved only. */
export function questionsFor(pack: TrackPack, ids: string[]): Question[] {
  return ids.flatMap((id) => {
    const q = pack.questions.get(id);
    return q ? [q] : [];
  });
}

/** All approved questions that belong to an owner, for the client-side grading JSON. */
export function ownerQuestions(pack: TrackPack, ownerId: string): Question[] {
  return [...pack.questions.values()].filter(
    (q) => q.conceptId === ownerId || q.problemId === ownerId,
  );
}

/** The item's own sim, or null for an `exception` sim or one that fails to resolve. */
export function resolveItemSim(item: Concept | Problem, pack: TrackPack): Sim | null {
  const s = item.sim;
  if ("exception" in s) return null;
  const r = resolveSimRef(s as SimRefInput, pack.sims);
  return r.ok ? r.sim : null;
}

/** A sim block's target: the item's own sim id, else a shared sim. */
export function resolveBlockSim(ref: string, item: Concept | Problem, pack: TrackPack): Sim | null {
  const own = resolveItemSim(item, pack);
  if (own && own.id === ref) return own;
  return pack.sims.find((s) => s.id === ref) ?? null;
}
