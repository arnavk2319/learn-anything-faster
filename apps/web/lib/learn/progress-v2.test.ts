import { describe, expect, it } from "vitest";
import {
  CURRENT_VERSION,
  STORAGE_KEY,
  emptyProgress,
  isTopicOpened,
  markSeen,
  markTopicOpened,
  migrate,
  readProgress,
  recordAnswer,
  writeProgress,
  type StorageLike,
} from "./progress";
import { burstAllowed, conceptJustFinished, correctRewards, openTopic } from "./rewards";

function mem(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(STORAGE_KEY, initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

// T-083: v1 blob as written by T-041 before the reward layer.
const V1_FIXTURE = {
  v: 1,
  favorites: {
    tracks: ["system-design"],
    concepts: ["caching"],
    problems: ["p1"],
    questions: ["q9"],
  },
  last: { trackId: "system-design", kind: "concept", id: "caching", at: 50 },
  items: { caching: { seenAt: 10, simViewed: true }, p1: { seenAt: 20 } },
  answers: { q1: { correct: true, at: 30 }, q2: { correct: false, at: 31, selfGraded: true } },
};

describe("v1 to v2 migration (T-083)", () => {
  it("is version 2", () => expect(CURRENT_VERSION).toBe(2));

  it("keeps all progress and favorites and adds firstOpened", () => {
    const m = migrate(V1_FIXTURE);
    expect(m.v).toBe(2);
    expect(m.favorites).toEqual(V1_FIXTURE.favorites);
    expect(m.last).toEqual(V1_FIXTURE.last);
    expect(m.items).toEqual(V1_FIXTURE.items);
    expect(m.answers).toEqual(V1_FIXTURE.answers);
    expect(m.firstOpened).toEqual({ "system-design": true });
  });

  it("v1 without last gets an empty firstOpened", () => {
    const noLast: Record<string, unknown> = { ...V1_FIXTURE };
    delete noLast.last;
    expect(migrate(noLast).firstOpened).toEqual({});
  });

  it("reads a stored v1 blob through readProgress", () => {
    expect(readProgress(mem(JSON.stringify(V1_FIXTURE))).favorites.tracks).toEqual([
      "system-design",
    ]);
  });

  it("corrupt blobs fall back to empty without throwing", () => {
    for (const raw of [
      "{not json",
      "null",
      "[1]",
      '{"v":2,"firstOpened":{"a":false}}',
      '{"v":2}',
    ]) {
      expect(() => readProgress(mem(raw))).not.toThrow();
      expect(readProgress(mem(raw))).toEqual(emptyProgress());
    }
    expect(() => migrate({ v: 1, favorites: 3 })).not.toThrow();
    expect(migrate({ v: 1, favorites: 3 })).toEqual(emptyProgress());
  });
});

describe("stored reward state is minimal (T-083)", () => {
  it("serialises only flags beside the existing keys", () => {
    const s = mem();
    let p = markTopicOpened(emptyProgress(), "system-design");
    p = markSeen(p, "caching", 5);
    p = recordAnswer(p, "q1", true, 6);
    writeProgress(p, s);
    const stored = JSON.parse(s.data.get(STORAGE_KEY) ?? "{}");
    expect(Object.keys(stored).sort()).toEqual([
      "answers",
      "favorites",
      "firstOpened",
      "items",
      "v",
    ]);
    expect(stored.firstOpened).toEqual({ "system-design": true });
    // No reward text, toast state or timestamps in the flag map.
    expect(JSON.stringify(stored.firstOpened)).toBe('{"system-design":true}');
  });

  it("rejects non-flag values in firstOpened", () => {
    expect(migrate({ ...emptyProgress(), firstOpened: { a: 123 } })).toEqual(emptyProgress());
  });
});

describe("once-only reward logic (T-083)", () => {
  it("first opened fires once per topic", () => {
    const a = openTopic(emptyProgress(), "t1");
    expect(a.fire).toBe(true);
    expect(isTopicOpened(a.next, "t1")).toBe(true);
    const b = openTopic(a.next, "t1");
    expect(b.fire).toBe(false);
    expect(openTopic(b.next, "t2").fire).toBe(true);
  });

  it("finished fires on not-done to done only", () => {
    const c = { id: "caching", quickCheckIds: ["q1"] };
    const seen = markSeen(emptyProgress(), "caching", 1);
    const done = recordAnswer(seen, "q1", false, 2);
    expect(conceptJustFinished(seen, done, c)).toBe(true);
    // Already done (reload then re-answer): no repeat.
    expect(conceptJustFinished(done, recordAnswer(done, "q1", true, 3), c)).toBe(false);
    expect(
      conceptJustFinished(emptyProgress(), seen, { id: "caching", quickCheckIds: ["q1"] }),
    ).toBe(false);
  });

  it("correct rewards once, burst is rate limited", () => {
    expect(correctRewards(undefined, true)).toBe(true);
    expect(correctRewards(false, true)).toBe(true);
    expect(correctRewards(true, true)).toBe(false);
    expect(correctRewards(undefined, false)).toBe(false);
    expect(burstAllowed(null, 100)).toBe(true);
    expect(burstAllowed(100, 1500)).toBe(false);
    expect(burstAllowed(100, 2100)).toBe(true);
  });
});
