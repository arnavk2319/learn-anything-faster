// Server component: poster island plus a numbered transcript that works with JS disabled (ADR-0015 section 2).
import type { Sim } from "@/lib/learn/schemas";
import { transcript } from "@/lib/learn/sim/engine";
import { getLayout } from "@/lib/learn/sim-render/layout";
import { SimLazy } from "./SimLazy";

export function SimFrame({ sim, title }: { sim: Sim; title: string }) {
  return (
    <section aria-label={`Simulation: ${title}`}>
      <SimLazy title={title} sim={sim} layout={getLayout(sim)} />
      <details className="mt-3 rounded-md border border-border bg-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Read this as text
        </summary>
        {sim.scenarios.map((sc) => (
          <div key={sc.id} className="mt-3">
            <h4 className="text-base font-semibold text-foreground">{sc.title}</h4>
            <ol className="mt-1 list-decimal pl-6 text-base text-foreground">
              {transcript(sim, sc).map((s) => (
                <li key={s.n}>{s.text}</li>
              ))}
            </ol>
          </div>
        ))}
      </details>
    </section>
  );
}
