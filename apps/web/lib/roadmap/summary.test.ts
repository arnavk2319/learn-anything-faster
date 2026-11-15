import { describe, expect, it } from "vitest";
import { summarizeRoadmap } from "./summary";

const t = (estHours?: number | null) => ({ estHours });

describe("summarizeRoadmap", () => {
  it("sums hours over shown topics and mentions covered ones", () => {
    const s = summarizeRoadmap({ topics: [t(3), t(4), t(2)], coveredCount: 5 });
    expect(s).toMatchObject({ topicCount: 3, totalHours: 9, coveredCount: 5 });
    expect(s.sentence).toBe("3 topics to learn, about 9 hours. Your role already covers 5.");
  });

  it("uses singular for one topic and one hour", () => {
    expect(summarizeRoadmap({ topics: [t(1)], coveredCount: 0 }).sentence).toBe(
      "1 topic to learn, about 1 hour.",
    );
  });

  it("returns no sentence for zero topics", () => {
    const s = summarizeRoadmap({ topics: [], coveredCount: 4 });
    expect(s.sentence).toBeNull();
    expect(s.totalHours).toBe(0);
  });

  it("skips topics without an estimate and says so, without NaN", () => {
    const s = summarizeRoadmap({
      topics: [t(3), t(undefined), t(null), t(Number.NaN)],
      coveredCount: 0,
    });
    expect(s.totalHours).toBe(3);
    expect(s.topicCount).toBe(4);
    expect(s.sentence).toContain("Some topics have no estimate yet.");
    expect(s.sentence).not.toContain("NaN");
  });

  it("omits hours when no topic has an estimate", () => {
    const s = summarizeRoadmap({ topics: [t(null)], coveredCount: 0 });
    expect(s.sentence).toBe("1 topic to learn. Some topics have no estimate yet.");
  });

  it("rounds fractional hours and never shows 0 hours when the total is positive", () => {
    expect(summarizeRoadmap({ topics: [t(1.4), t(2.4)], coveredCount: 0 }).totalHours).toBe(4);
    const s = summarizeRoadmap({ topics: [t(0.2)], coveredCount: 0 });
    expect(s.totalHours).toBe(1);
    expect(s.sentence).not.toContain("0 hours");
  });

  it("follows the copy rules", () => {
    const s = summarizeRoadmap({ topics: [t(3), t(5)], coveredCount: 2 }).sentence ?? "";
    expect(s).not.toContain(" · ");
    expect(s.toLowerCase()).not.toContain("built from");
    expect(s.toLowerCase()).not.toContain("links");
    expect(s).not.toMatch(/[!→]|simply|please/i);
  });
});
