import { QueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import seed from "../../../data/seed/fullstack-to-ml-engineer.json";
import { RouteLine } from "../components/route/RouteLine";
import { fetchRoadmap, roadmapKey } from "./roadmap/client";
import type { RoadmapResponse } from "./roadmap/schema";
import { deriveRouteView, previewFromRoadmap, type RouteView } from "./route-view";

const node = (id: string, name: string, area: string, estHours: number) => ({
  id,
  name,
  area,
  why: "w",
  estHours,
  resources: [],
});
const pairB: RoadmapResponse = {
  from: { id: "data-analyst", name: "Data analyst" },
  to: { id: "data-engineer", name: "Data engineer" },
  nodes: [
    node("t1", "Airflow DAGs", "orchestration", 4),
    node("t2", "Warehouse design", "storage", 6),
  ],
  edges: [],
  covered: [{ id: "c1", name: "SQL", area: "storage" }],
};
const render = (view: RouteView, from?: string, to?: string) =>
  renderToStaticMarkup(
    createElement(RouteLine, {
      state: view.kind,
      preview: view.kind === "live" ? view.preview : undefined,
      fromName: from,
      toName: to,
    }),
  );
const base = { chosen: true, same: false, isCurated: true };

describe("landing route view", () => {
  it("abstract before any pick: no seed topic title, role name, hours or link", () => {
    const html = render(deriveRouteView({ chosen: false, same: false, isCurated: false }));
    expect(html).toContain('data-state="abstract"');
    for (const t of (seed as { topics: { name: string }[] }).topics)
      expect(html).not.toContain(t.name);
    for (const a of (seed as { areas: { name: string }[] }).areas)
      expect(html).not.toContain(a.name);
    expect(html).not.toMatch(/Full-stack|ML engineer|hours|href/);
  });

  it("shows the picked pair's real labels, not the default pair's", () => {
    const view = deriveRouteView({ ...base, data: pairB });
    const html = render(view, "Data analyst", "Data engineer");
    expect(html).toContain("Orchestration");
    expect(html).toContain("Storage");
    expect(html).toContain("Data engineer");
    expect(html).toContain("About 10 hours");
    expect(html).not.toContain("Math foundations");
    expect(html).not.toContain("ML engineer");
    expect(previewFromRoadmap(pairB)).toMatchObject({ topicCount: 2, knownCount: 1, hours: 10 });
  });

  it("falls back: same pair, empty nodes, loading or API error are abstract", () => {
    expect(deriveRouteView({ ...base, same: true, data: pairB }).kind).toBe("abstract");
    expect(deriveRouteView({ ...base, data: { ...pairB, nodes: [] } }).kind).toBe("abstract");
    expect(deriveRouteView({ ...base }).kind).toBe("abstract"); // loading or non-404 error: no data
  });

  it("unmapped pair (not curated, or 404) keeps the muted unmapped state", () => {
    expect(deriveRouteView({ ...base, isCurated: false }).kind).toBe("unmapped");
    expect(deriveRouteView({ ...base, unmappedError: true }).kind).toBe("unmapped");
    expect(render({ kind: "unmapped" }, "A", "B")).toContain('data-muted="true"');
  });

  it("rapid changes: each pair has its own query key, so a slow earlier response is never shown", async () => {
    const realFetch = globalThis.fetch;
    const pairA = {
      ...pairB,
      to: { id: "x", name: "X" },
      nodes: [node("a1", "Old topic", "old", 1)],
    };
    globalThis.fetch = ((url: string, init?: { signal?: AbortSignal }) => {
      const isA = String(url).includes("to=x");
      return new Promise((resolve, reject) => {
        const done = () => resolve(new Response(JSON.stringify(isA ? pairA : pairB)));
        const t = setTimeout(done, isA ? 40 : 1);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    }) as typeof fetch;
    try {
      const qc = new QueryClient();
      const slowA = qc.fetchQuery({
        queryKey: roadmapKey("data-analyst", "x"),
        queryFn: ({ signal }) => fetchRoadmap("data-analyst", "x", signal),
      });
      await qc.fetchQuery({
        queryKey: roadmapKey("data-analyst", "data-engineer"),
        queryFn: ({ signal }) => fetchRoadmap("data-analyst", "data-engineer", signal),
      });
      // The view for the current (last) pair reads only its own key.
      const current = qc.getQueryData<RoadmapResponse>(roadmapKey("data-analyst", "data-engineer"));
      const view = deriveRouteView({ ...base, data: current });
      expect(view.kind === "live" && view.preview.stops.map((s) => s.name)).toEqual([
        "Orchestration",
        "Storage",
      ]);
      await slowA;
      expect(render(view)).not.toContain("Old");
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
