// T-090: the server and first client render are always the wide layout (no hydration mismatch).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { templateSims } from "@/lib/learn/sim-render/generate-layouts";
import { getLayout, getNarrowLayout } from "@/lib/learn/sim-render/layout";
import { frameAt, stepTimes } from "@/lib/learn/sim-render/view";
import { SimView } from "./SimView";

describe("SimView layout mode", () => {
  it("first render is wide even when a narrow layout is supplied, with no minimum width", () => {
    const sim = templateSims()[0]!;
    const sc = sim.scenarios[0]!.id;
    const out = renderToStaticMarkup(
      createElement(SimView, {
        title: "Fixture",
        sim,
        layout: getLayout(sim),
        narrowLayout: getNarrowLayout(sim),
        scenarioId: sc,
        frame: frameAt(sim, sc, 0, false),
        pulsed: [],
        steps: stepTimes(sim, sc),
        playing: false,
        speed: 1,
        reduced: false,
        interactive: false,
        selected: null,
      }),
    );
    expect(out).toContain('data-layout="wide"');
    expect(out).not.toContain("min-w-[680px]");
    expect(out).toContain(`viewBox="0 0 ${getLayout(sim).width} ${getLayout(sim).height}"`);
  });
});
