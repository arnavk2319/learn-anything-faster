import type { Metadata } from "next";
import { SimFrame } from "@/components/learn/SimFrame";
import { compileTemplate, TEMPLATE_NAMES } from "@/lib/learn/sim/templates";

// Gate 3 / e2e preview of the sim renderer using the engine's template sims. Not linked, not indexed.
export const metadata: Metadata = { title: "Sim preview", robots: { index: false, follow: false } };

export default function SimPreviewPage() {
  const sims = TEMPLATE_NAMES.flatMap((name) => {
    const r = compileTemplate({ id: name, template: name });
    return r.ok ? [r.sim] : [];
  });
  return (
    <main className="mx-auto max-w-5xl space-y-10 p-8">
      <h1 className="font-display text-3xl font-bold">Sim preview</h1>
      <p className="text-muted-foreground">
        Template simulations rendered by the Learn sim renderer.
      </p>
      {sims.map((sim) => (
        <div key={sim.id} id={sim.id}>
          <h2 className="mb-3 font-display text-xl font-semibold">{sim.template}</h2>
          <SimFrame sim={sim} title={sim.template ?? sim.id} />
        </div>
      ))}
    </main>
  );
}
