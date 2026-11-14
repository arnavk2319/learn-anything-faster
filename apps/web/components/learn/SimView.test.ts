// Component test: inspector live-state widgets and decision verdicts follow the frame (ADR-0015 section 2).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Sim } from "@/lib/learn/schemas";
import { fallbackLayout } from "@/lib/learn/sim-render/layout";
import { frameAt, stepTimes } from "@/lib/learn/sim-render/view";
import { SimView } from "./SimView";

const sim: Sim = {
  id: "fixture",
  durationMs: 4000,
  loop: false,
  nodes: [
    {
      id: "lru",
      kind: "cache",
      label: "Cache",
      inspect: "lru",
      state: { type: "lru", capacity: 3, init: ["b", "c", "a"] },
    },
    {
      id: "q",
      kind: "queue",
      label: "Queue",
      inspect: "q",
      state: { type: "queue", init: ["j1"] },
    },
    {
      id: "kv",
      kind: "store",
      label: "Store",
      inspect: "kv",
      state: { type: "kv", init: { x: "1" } },
    },
    { id: "n", kind: "store", label: "Counter", inspect: "n", state: { type: "counter", init: 0 } },
    {
      id: "r",
      kind: "lb",
      label: "Ring",
      inspect: "r",
      state: { type: "ring", init: ["n1", "n2"] },
    },
    { id: "d", kind: "decision", label: "Hit?", inspect: "Decides." },
  ],
  edges: [{ id: "e1", from: "lru", to: "d" }],
  scenarios: [
    {
      id: "s1",
      title: "One",
      events: [
        { at: 100, state: { node: "lru", op: "touch", key: "c" } },
        { at: 100, state: { node: "q", op: "push", key: "j2" } },
        { at: 100, state: { node: "kv", op: "set", key: "y", value: "2" } },
        { at: 100, state: { node: "n", op: "inc" } },
        { at: 100, state: { node: "r", op: "add", key: "n3" } },
        { at: 100, decide: { node: "d", result: "yes" } },
        { at: 200, caption: "done" },
      ],
    },
    {
      id: "s2",
      title: "Two",
      events: [
        { at: 100, decide: { node: "d", result: "no" } },
        { at: 200, caption: "no" },
      ],
    },
  ],
} as Sim;

function html(t: number, selected: string | null, scenarioId = "s1") {
  return renderToStaticMarkup(
    createElement(SimView, {
      title: "Fixture",
      sim,
      layout: fallbackLayout(sim),
      scenarioId,
      frame: frameAt(sim, scenarioId, t, false),
      pulsed: [],
      steps: stepTimes(sim, scenarioId),
      playing: false,
      speed: 1,
      reduced: false,
      interactive: true,
      selected,
    }),
  );
}
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("inspector live state", () => {
  it("shows init state at t=0 and updated state after the events", () => {
    expect(text(html(0, "lru"))).toContain("b, c, a (most recent to least recent)");
    expect(text(html(300, "lru"))).toContain("c, b, a (most recent to least recent)");
    expect(text(html(0, "q"))).toContain("Contents j1");
    expect(text(html(300, "q"))).toContain("j1, j2");
    expect(text(html(0, "kv"))).toContain("x=1");
    expect(text(html(300, "kv"))).toContain("x=1, y=2");
    expect(text(html(0, "n"))).toContain("Contents 0");
    expect(text(html(300, "n"))).toContain("Contents 1");
    expect(text(html(0, "r"))).toContain("n1, n2");
    expect(text(html(300, "r"))).toContain("n1, n2, n3");
  });

  it("shows the inspect text, and exposes the dialog semantics of the sheet", () => {
    const h = html(0, "d");
    expect(text(h)).toContain("Decides.");
    expect(h).toContain('aria-label="Hit? details"');
  });

  it("decision node shows the chosen branch from the decide event", () => {
    expect(text(html(300, null, "s1"))).toContain("yes");
    const no = text(html(300, null, "s2"));
    expect(no).toContain("no");
    expect(no).not.toContain(" yes ");
    expect(text(html(0, null))).not.toMatch(/Hit\?\s+(yes|no)/);
  });
});
