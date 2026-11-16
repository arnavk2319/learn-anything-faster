import { describe, expect, it } from "vitest";
import { summarizeRoadmap } from "../../lib/roadmap/summary";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PopularMoves } from "./PopularMoves";
import { cardMeta, cardSummary, cardTag } from "./popular-card";

const nodes = [{ estHours: 3 }, { estHours: 4.4 }, { estHours: 2 }];

describe("popular card", () => {
  it("hours equal summarizeRoadmap output", () => {
    const s = summarizeRoadmap({ topics: nodes, coveredCount: 2 });
    const c = cardSummary(nodes, 2);
    expect(c).toEqual({ topicCount: s.topicCount, hours: s.totalHours });
    expect(cardMeta("live", c)).toBe(`3 topics, about ${s.totalHours} hours`);
  });

  it("soon cards say Get notified and show no hours", () => {
    expect(cardMeta("coming_soon", null)).toBe("Get notified");
    expect(cardTag("coming_soon")).toBe("Soon");
  });

  it("falls back without inventing numbers when there are no topics", () => {
    expect(cardSummary([], 0)).toBeNull();
    expect(cardMeta("live", null)).toBe("Open the roadmap");
  });

  it("link name (its text content) includes status, title and meta; no aria-label overrides it", () => {
    const html = renderToStaticMarkup(
      createElement(PopularMoves, {
        moves: [
          {
            from: "a",
            fromName: "A",
            to: "b",
            toName: "B",
            status: "live",
            summary: { topicCount: 3, hours: 9 },
          },
          { from: "a", fromName: "A", to: "c", toName: "C", status: "coming_soon" },
        ],
      }),
    );
    const names = [...html.matchAll(/<a [^>]*data-testid="popular-card"[^>]*>(.*?)<\/a>/g)].map(
      (m) =>
        (m[1] ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
    );
    expect(names).toEqual(["Live A to B 3 topics, about 9 hours", "Soon A to C Get notified"]);
    expect(html).not.toContain(`aria-label="`);
  });
});
