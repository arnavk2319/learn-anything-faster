// Server component: poster island; the numbered transcript lives inside the sim card and works with JS disabled (ADR-0015 section 2).
import type { Sim } from "@/lib/learn/schemas";
import { getLayout, getNarrowLayout } from "@/lib/learn/sim-render/layout";
import { SimLazy } from "./SimLazy";

export function SimFrame({ sim, title }: { sim: Sim; title: string }) {
  return (
    <section aria-label={`Simulation: ${title}`}>
      <SimLazy
        title={title}
        sim={sim}
        layout={getLayout(sim)}
        narrowLayout={getNarrowLayout(sim)}
      />
    </section>
  );
}
