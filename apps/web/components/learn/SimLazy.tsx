"use client";
// Renders the static poster (frame 0) on the server, then loads the interactive player only once
// the sim scrolls into view (IntersectionObserver). The player module is code-split.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Sim } from "@/lib/learn/schemas";
import type { SimLayout } from "@/lib/learn/sim-render/layout";
import { frameAt, stepTimes } from "@/lib/learn/sim-render/view";
import { SimView } from "./SimView";

const SimPlayer = lazy(() => import("./SimPlayer"));

export function SimLazy({ title, sim, layout }: { title: string; sim: Sim; layout: SimLayout }) {
  const [live, setLive] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setLive(true);
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setLive(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sc = sim.scenarios[0]?.id ?? "";
  const poster = (
    <SimView
      title={title}
      sim={sim}
      layout={layout}
      scenarioId={sc}
      frame={frameAt(sim, sc, 0, true)}
      pulsed={[]}
      steps={stepTimes(sim, sc)}
      playing={false}
      speed={1}
      reduced={false}
      interactive={false}
      selected={null}
    />
  );
  return (
    <div ref={ref} data-sim-island={live ? "live" : "poster"}>
      {live ? (
        <Suspense fallback={poster}>
          <SimPlayer title={title} sim={sim} layout={layout} />
        </Suspense>
      ) : (
        poster
      )}
    </div>
  );
}
