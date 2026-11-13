import { z } from "zod";

// Anonymous learner progress and favorites in localStorage (ADR-0015 section 6).
// Only ids, booleans and timestamps are stored: no PII, no free text.

export const STORAGE_KEY = "laf:learn:v1";
export const CURRENT_VERSION = 1;

const IdList = z.array(z.string().min(1).max(200));

export const ProgressSchema = z.strictObject({
  v: z.literal(CURRENT_VERSION),
  favorites: z.strictObject({
    tracks: IdList,
    concepts: IdList,
    problems: IdList,
    questions: IdList,
  }),
  last: z
    .strictObject({
      trackId: z.string().min(1).max(200),
      kind: z.enum(["concept", "problem", "set"]),
      id: z.string().min(1).max(200),
      at: z.number(),
    })
    .optional(),
  items: z.record(
    z.string(),
    z.strictObject({ seenAt: z.number().optional(), simViewed: z.boolean().optional() }),
  ),
  answers: z.record(
    z.string(),
    z.strictObject({
      correct: z.boolean(),
      at: z.number(),
      selfGraded: z.boolean().optional(),
    }),
  ),
});

export type Progress = z.infer<typeof ProgressSchema>;
export type FavoriteKind = keyof Progress["favorites"];

export function emptyProgress(): Progress {
  return {
    v: CURRENT_VERSION,
    favorites: { tracks: [], concepts: [], problems: [], questions: [] },
    items: {},
    answers: {},
  };
}

/** Migrators keyed by the version they upgrade FROM. v0 had flat `favs` and `seen` maps. */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  0: (old) => {
    const favs = (old.favs ?? {}) as Record<string, unknown>;
    const seen = (old.seen ?? {}) as Record<string, unknown>;
    const items: Record<string, unknown> = {};
    for (const [id, at] of Object.entries(seen)) {
      items[id] = typeof at === "number" ? { seenAt: at } : {};
    }
    return {
      v: 1,
      favorites: {
        tracks: favs.tracks ?? [],
        concepts: favs.concepts ?? [],
        problems: favs.problems ?? [],
        questions: favs.questions ?? [],
      },
      items,
      answers: old.answers ?? {},
    };
  },
};

/** Run migrators up to the current version, then validate. Never throws; invalid becomes empty. */
export function migrate(raw: unknown): Progress {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return emptyProgress();
  let data = raw as Record<string, unknown>;
  let v = typeof data.v === "number" ? data.v : 0;
  if (!Number.isInteger(v) || v < 0 || v > CURRENT_VERSION) return emptyProgress();
  while (v < CURRENT_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) return emptyProgress();
    data = step(data);
    v = typeof data.v === "number" ? data.v : CURRENT_VERSION;
  }
  const parsed = ProgressSchema.safeParse(data);
  return parsed.success ? parsed.data : emptyProgress();
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Resolve localStorage lazily so importing on the server never touches `window`. */
function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readProgress(storage: StorageLike | null = defaultStorage()): Progress {
  if (!storage) return emptyProgress();
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text === null) return emptyProgress();
    return migrate(JSON.parse(text));
  } catch {
    return emptyProgress();
  }
}

export function writeProgress(p: Progress, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // quota or privacy mode: progress is best effort
  }
}

// Pure updaters: return a new Progress.

export function toggleFavorite(p: Progress, kind: FavoriteKind, id: string): Progress {
  const list = p.favorites[kind];
  const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  return { ...p, favorites: { ...p.favorites, [kind]: next } };
}

export function markSeen(p: Progress, id: string, at: number): Progress {
  return {
    ...p,
    items: { ...p.items, [id]: { ...p.items[id], seenAt: p.items[id]?.seenAt ?? at } },
  };
}

export function markSimViewed(p: Progress, id: string): Progress {
  return { ...p, items: { ...p.items, [id]: { ...p.items[id], simViewed: true } } };
}

export function recordAnswer(
  p: Progress,
  questionId: string,
  correct: boolean,
  at: number,
  selfGraded?: boolean,
): Progress {
  const entry = selfGraded === undefined ? { correct, at } : { correct, at, selfGraded };
  return { ...p, answers: { ...p.answers, [questionId]: entry } };
}

export function setLast(p: Progress, last: NonNullable<Progress["last"]>): Progress {
  return { ...p, last };
}

// Derived progress.

/** Concept done = seen plus its quick check answered (a concept with no quick check needs only seen). */
export function isConceptDone(p: Progress, conceptId: string, quickCheckIds: string[]): boolean {
  if (p.items[conceptId]?.seenAt === undefined) return false;
  return quickCheckIds.every((q) => p.answers[q] !== undefined);
}

export function setProgress(
  p: Progress,
  questionIds: string[],
): { answered: number; total: number; ratio: number } {
  const total = questionIds.length;
  const answered = questionIds.filter((q) => p.answers[q] !== undefined).length;
  return { answered, total, ratio: total === 0 ? 0 : answered / total };
}

export const DEFAULT_WEIGHTS = { concept: 1, problem: 2 } as const;

/** Track ring 0..1: weighted share of concepts done and problems seen. */
export function trackProgress(
  p: Progress,
  track: { concepts: { id: string; quickCheckIds: string[] }[]; problemIds: string[] },
  weights: { concept: number; problem: number } = DEFAULT_WEIGHTS,
): number {
  const total = track.concepts.length * weights.concept + track.problemIds.length * weights.problem;
  if (total === 0) return 0;
  const done =
    track.concepts.filter((c) => isConceptDone(p, c.id, c.quickCheckIds)).length * weights.concept +
    track.problemIds.filter((id) => p.items[id]?.seenAt !== undefined).length * weights.problem;
  return done / total;
}

/**
 * Subscribe to cross-tab changes via the `storage` event. Returns an unsubscribe function.
 * No-op on the server.
 */
export function subscribeProgress(
  onChange: (p: Progress) => void,
  target: Pick<Window, "addEventListener" | "removeEventListener"> | null = typeof window ===
  "undefined"
    ? null
    : window,
  storage: StorageLike | null = defaultStorage(),
): () => void {
  if (!target) return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    onChange(readProgress(storage));
  };
  target.addEventListener("storage", handler);
  return () => target.removeEventListener("storage", handler);
}
