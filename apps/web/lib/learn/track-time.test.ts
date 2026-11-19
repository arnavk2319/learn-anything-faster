import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrackTime } from "../../components/learn/TrackTime";
import { formatEstimate, sumTrackMinutes } from "./estimate";

const item = (status: string, estMin?: number) => ({ status, estMin });

describe("sumTrackMinutes", () => {
  it("adds approved items only", () => {
    expect(sumTrackMinutes([item("approved", 30), item("proposed", 500), item("draft", 500)])).toBe(
      30,
    );
  });
  it("items without estMin add nothing; partial sums still count", () => {
    expect(sumTrackMinutes([item("approved", 45), item("approved"), item("approved", 45)])).toBe(
      90,
    );
  });
  it("returns null when no approved item has estMin", () => {
    expect(sumTrackMinutes([])).toBeNull();
    expect(sumTrackMinutes([item("approved"), item("proposed", 20)])).toBeNull();
  });
});

describe("track time rendering", () => {
  it.each([
    [90, "About 2 hours"],
    [30, "Under 1 hour"],
  ])("%i min via formatEstimate", (m, text) => {
    expect(formatEstimate(m)).toBe(text);
    const html = renderToStaticMarkup(createElement(TrackTime, { minutes: m }));
    expect(html).toContain(text);
    expect(html).not.toMatch(/week/i);
  });
  it("renders no element when the sum is null", () => {
    expect(renderToStaticMarkup(createElement(TrackTime, { minutes: null }))).toBe("");
  });
});
