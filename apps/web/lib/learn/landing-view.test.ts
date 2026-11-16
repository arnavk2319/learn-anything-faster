import { describe, expect, it } from "vitest";
import { countsInWords, filterTracks, parseFilter, type LandingTrack } from "./landing-view";
import { emptyProgress, markSeen, toggleFavorite } from "./progress";

const live: LandingTrack = {
  id: "system-design",
  title: "System design",
  summary: "Design systems",
  status: "live",
  counts: { concepts: 2, problems: 1, questions: 4 },
  addedByUs: true,
  concepts: [
    { id: "caching", quickCheckIds: [] },
    { id: "queues", quickCheckIds: [] },
  ],
  problemIds: [],
};
const soon: LandingTrack = {
  ...live,
  id: "ai-engineering",
  title: "AI engineering",
  status: "soon",
  counts: { concepts: 0, problems: 0, questions: 0 },
  concepts: [],
};
const all = [live, soon];

describe("parseFilter", () => {
  it("accepts known values and falls back to all", () => {
    expect(parseFilter("favorites")).toBe("favorites");
    expect(parseFilter("bogus")).toBe("all");
    expect(parseFilter(null)).toBe("all");
  });
});

describe("filterTracks", () => {
  it("live and soon split by status", () => {
    expect(filterTracks(all, "live", emptyProgress()).map((t) => t.id)).toEqual(["system-design"]);
    expect(filterTracks(all, "soon", emptyProgress()).map((t) => t.id)).toEqual(["ai-engineering"]);
  });
  it("favorites come from the progress module", () => {
    expect(filterTracks(all, "favorites", emptyProgress())).toEqual([]);
    const p = toggleFavorite(emptyProgress(), "tracks", "ai-engineering");
    expect(filterTracks(all, "favorites", p).map((t) => t.id)).toEqual(["ai-engineering"]);
  });
  it("in progress means started but not finished", () => {
    expect(filterTracks(all, "progress", emptyProgress())).toEqual([]);
    const half = markSeen(emptyProgress(), "caching", 1);
    expect(filterTracks(all, "progress", half).map((t) => t.id)).toEqual(["system-design"]);
    const done = markSeen(half, "queues", 2);
    expect(filterTracks(all, "progress", done)).toEqual([]);
  });
  it("a seen concept with an unanswered quick check counts as in progress", () => {
    const t = { ...live, concepts: [{ id: "caching", quickCheckIds: ["q1"] }] };
    expect(filterTracks([t], "progress", markSeen(emptyProgress(), "caching", 1))).toHaveLength(1);
  });
  it("title query narrows the list", () => {
    expect(filterTracks(all, "all", emptyProgress(), "ai eng").map((t) => t.id)).toEqual([
      "ai-engineering",
    ]);
    expect(filterTracks(all, "all", emptyProgress(), "zzz")).toEqual([]);
    expect(filterTracks(all, "all", emptyProgress(), "AI").map((t) => t.id)).toEqual([
      "ai-engineering",
    ]);
  });
});

describe("countsInWords", () => {
  it("spells counts out and singularises one", () => {
    expect(countsInWords({ concepts: 12, problems: 1, questions: 0 })).toBe(
      "12 concepts, 1 problem, 0 questions",
    );
  });
});
