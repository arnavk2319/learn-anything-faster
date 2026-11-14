import { describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  emptyProgress,
  isConceptDone,
  markSeen,
  migrate,
  readProgress,
  recordAnswer,
  setProgress,
  subscribeProgress,
  toggleFavorite,
  trackProgress,
  writeProgress,
  type StorageLike,
} from "./progress";

function memStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("storage", () => {
  it("round-trips a valid value", () => {
    const s = memStorage();
    const p = recordAnswer(
      markSeen(toggleFavorite(emptyProgress(), "tracks", "t1"), "c1", 5),
      "q1",
      true,
      6,
    );
    writeProgress(p, s);
    expect(readProgress(s)).toEqual(p);
  });

  it("resets corrupt data without throwing", () => {
    expect(readProgress(memStorage("{not json"))).toEqual(emptyProgress());
    expect(readProgress(memStorage(JSON.stringify({ v: 1, favorites: 3 })))).toEqual(
      emptyProgress(),
    );
    expect(readProgress(memStorage(JSON.stringify([1, 2])))).toEqual(emptyProgress());
    expect(readProgress(memStorage(JSON.stringify({ v: 99 })))).toEqual(emptyProgress());
  });

  it("rejects unknown keys so free text cannot be smuggled in", () => {
    const bad = { ...emptyProgress(), note: "my email is a@b.c" };
    expect(readProgress(memStorage(JSON.stringify(bad)))).toEqual(emptyProgress());
  });

  it("returns empty when storage is missing or throws", () => {
    expect(readProgress(null)).toEqual(emptyProgress());
    const boom: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(readProgress(boom)).toEqual(emptyProgress());
    expect(() => writeProgress(emptyProgress(), boom)).not.toThrow();
  });
});

describe("migration", () => {
  it("migrates a v0 fixture", () => {
    const v0 = {
      v: 0,
      favs: { tracks: ["t1"], concepts: ["c1"] },
      seen: { c1: 100, p1: 200 },
      answers: { q1: { correct: true, at: 300 } },
    };
    const m = migrate(v0);
    expect(m.v).toBe(1);
    expect(m.favorites).toEqual({ tracks: ["t1"], concepts: ["c1"], problems: [], questions: [] });
    expect(m.items).toEqual({ c1: { seenAt: 100 }, p1: { seenAt: 200 } });
    expect(m.answers.q1).toEqual({ correct: true, at: 300 });
  });

  it("treats a missing v as v0", () => {
    expect(migrate({ seen: { c1: 1 } }).items.c1?.seenAt).toBe(1);
  });
});

describe("derived progress", () => {
  const quick = ["q1", "q2"];
  it("concept done needs seen and quick check answered", () => {
    let p = emptyProgress();
    expect(isConceptDone(p, "c1", quick)).toBe(false);
    p = markSeen(p, "c1", 1);
    expect(isConceptDone(p, "c1", quick)).toBe(false);
    p = recordAnswer(p, "q1", false, 2);
    expect(isConceptDone(p, "c1", quick)).toBe(false);
    p = recordAnswer(p, "q2", true, 3);
    expect(isConceptDone(p, "c1", quick)).toBe(true);
    expect(isConceptDone(recordAnswer(emptyProgress(), "q1", true, 1), "c1", ["q1"])).toBe(false);
  });

  it("set progress is answered over total", () => {
    const p = recordAnswer(emptyProgress(), "q1", true, 1);
    expect(setProgress(p, ["q1", "q2", "q3", "q4"])).toEqual({
      answered: 1,
      total: 4,
      ratio: 0.25,
    });
    expect(setProgress(p, []).ratio).toBe(0);
  });

  it("track ring weights concepts and problems", () => {
    const track = {
      concepts: [
        { id: "c1", quickCheckIds: ["q1"] },
        { id: "c2", quickCheckIds: [] },
      ],
      problemIds: ["p1"],
    };
    let p = emptyProgress();
    expect(trackProgress(p, track)).toBe(0);
    p = recordAnswer(markSeen(p, "c1", 1), "q1", true, 2);
    expect(trackProgress(p, track)).toBeCloseTo(1 / 4); // 1 of (1+1+2)
    p = markSeen(p, "p1", 3);
    expect(trackProgress(p, track)).toBeCloseTo(3 / 4);
    expect(trackProgress(p, track, { concept: 1, problem: 1 })).toBeCloseTo(2 / 3);
    expect(trackProgress(p, { concepts: [], problemIds: [] })).toBe(0);
  });

  it("markSeen keeps the first seenAt", () => {
    const p = markSeen(markSeen(emptyProgress(), "c1", 1), "c1", 9);
    expect(p.items.c1?.seenAt).toBe(1);
  });

  it("toggleFavorite adds then removes", () => {
    const a = toggleFavorite(emptyProgress(), "questions", "q1");
    expect(a.favorites.questions).toEqual(["q1"]);
    expect(toggleFavorite(a, "questions", "q1").favorites.questions).toEqual([]);
  });
});

describe("cross-tab sync", () => {
  it("re-reads on a storage event for our key only", () => {
    const s = memStorage();
    let handler: ((e: StorageEvent) => void) | undefined;
    const target = {
      addEventListener: vi.fn((_t: string, h: EventListenerOrEventListenerObject) => {
        handler = h as (e: StorageEvent) => void;
      }),
      removeEventListener: vi.fn(),
    };
    const seen: unknown[] = [];
    const off = subscribeProgress((p) => seen.push(p), target, s);
    writeProgress(toggleFavorite(emptyProgress(), "tracks", "t1"), s);
    handler?.({ key: "other" } as StorageEvent);
    expect(seen).toHaveLength(0);
    handler?.({ key: STORAGE_KEY } as StorageEvent);
    expect(seen).toHaveLength(1);
    expect((seen[0] as { favorites: { tracks: string[] } }).favorites.tracks).toEqual(["t1"]);
    off();
    expect(target.removeEventListener).toHaveBeenCalled();
  });
});

describe("SSR safety", () => {
  it("does not touch window when absent", () => {
    expect(typeof window).toBe("undefined");
    expect(readProgress()).toEqual(emptyProgress());
    expect(() => writeProgress(emptyProgress())).not.toThrow();
    expect(subscribeProgress(() => {})).toBeTypeOf("function");
  });
});
