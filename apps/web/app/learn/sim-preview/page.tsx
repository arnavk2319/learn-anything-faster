import type { Metadata } from "next";
import { SimFrame } from "@/components/learn/SimFrame";
import type { Sim } from "@/lib/learn/schemas";
import { compileTemplate, TEMPLATE_NAMES } from "@/lib/learn/sim/templates";

// Gate 3 / e2e preview of the sim renderer using the engine's template sims. Not linked, not indexed.
export const metadata: Metadata = { title: "Sim preview", robots: { index: false, follow: false } };

// Bespoke fixture with a decision node and two scenarios, for the inspector and decide e2e (T-043).
const decisionSim: Sim = {
  id: "decision-fixture",
  durationMs: 6000,
  src: { kind: "gap", note: "preview fixture, not content" },
  loop: false,
  nodes: [
    { id: "app", kind: "app", label: "App", inspect: "Asks the cache first." },
    {
      id: "cache",
      kind: "cache",
      label: "Cache (LRU, 3)",
      inspect: "Holds hot keys most-recent-first.",
      state: { type: "lru", capacity: 3, init: ["b", "c", "a"] },
    },
    { id: "hit", kind: "decision", label: "Hit?", inspect: "Is the key in the cache?" },
    { id: "db", kind: "db", label: "Database", inspect: "Source of truth; the slow path." },
  ],
  edges: [
    { id: "e1", from: "app", to: "cache" },
    { id: "e2", from: "cache", to: "hit" },
    { id: "e3", from: "hit", to: "db", label: "miss" },
  ],
  scenarios: [
    {
      id: "yes",
      title: "Decide yes",
      events: [
        { at: 0, send: { edge: "e1", token: { label: "GET c" } } },
        { at: 800, decide: { node: "hit", result: "yes" } },
        { at: 800, caption: "Hit: c is served from the cache" },
      ],
    },
    {
      id: "no",
      title: "Decide no",
      events: [
        { at: 0, send: { edge: "e1", token: { label: "GET d" } } },
        { at: 800, decide: { node: "hit", result: "no" } },
        { at: 800, caption: "Miss: d goes to the database" },
      ],
    },
  ],
};

export default function SimPreviewPage() {
  const sims = [
    ...TEMPLATE_NAMES.flatMap((name) => {
      const r = compileTemplate({ id: name, template: name });
      return r.ok ? [r.sim] : [];
    }),
    decisionSim,
  ];
  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <h1 className="font-display text-3xl font-bold">Sim preview</h1>
      <p className="text-muted-foreground">
        Template simulations rendered by the Learn sim renderer.
      </p>
      {sims.map((sim) => (
        <div key={sim.id} id={sim.id}>
          <h2 className="mb-3 font-display text-xl font-semibold">{sim.template ?? sim.id}</h2>
          <SimFrame sim={sim} title={sim.template ?? sim.id} />
        </div>
      ))}
    </main>
  );
}
