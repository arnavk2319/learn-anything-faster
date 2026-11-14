"use client";
// Interactive sim runtime: state, the shared rAF subscription, visibility pausing, keyboard and focus.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Sim } from "@/lib/learn/schemas";
import { usePrefersReducedMotion } from "@/lib/roadmap/use-prefers-reduced-motion";
import type { SimLayout } from "@/lib/learn/sim-render/layout";
import { subscribeTicker } from "@/lib/learn/sim-render/ticker";
import {
  frameAt,
  pulsedNodes,
  stepTarget,
  stepTimes,
  type Speed,
} from "@/lib/learn/sim-render/view";
import { SimView } from "./SimView";

export default function SimPlayer({
  title,
  sim,
  layout,
}: {
  title: string;
  sim: Sim;
  layout: SimLayout;
}) {
  const reduced = usePrefersReducedMotion();
  const [scenarioId, setScenarioId] = useState(sim.scenarios[0]?.id ?? "");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const tRef = useRef(0);
  const speedRef = useRef<Speed>(1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, SVGGElement | null>>({});
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastSelected = useRef<string | null>(null);
  speedRef.current = speed;

  const setTime = useCallback((v: number) => {
    tRef.current = v;
    setT(v);
  }, []);

  // Autoplay once, unless the user prefers reduced motion. Pause is always available.
  useEffect(() => {
    setPlaying(!reduced);
  }, [reduced]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setTabHidden(document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const running = playing && onScreen && !tabHidden;
  useEffect(() => {
    if (!running) return;
    return subscribeTicker((dt) => {
      const next = tRef.current + dt * speedRef.current;
      if (!sim.loop && next >= sim.durationMs) {
        setTime(sim.durationMs);
        setPlaying(false);
        return;
      }
      setTime(sim.loop ? next % sim.durationMs : next);
    });
  }, [running, sim.loop, sim.durationMs, setTime]);

  // Focus: Close on open, back to the node on close.
  useEffect(() => {
    if (selected) closeRef.current?.focus();
    else if (lastSelected.current) nodeRefs.current[lastSelected.current]?.focus();
    lastSelected.current = selected;
  }, [selected]);

  const steps = stepTimes(sim, scenarioId);
  const frame = frameAt(sim, scenarioId, t, reduced && !playing);

  return (
    <SimView
      title={title}
      sim={sim}
      layout={layout}
      scenarioId={scenarioId}
      frame={frame}
      pulsed={pulsedNodes(sim, scenarioId, frame.t)}
      steps={steps}
      playing={playing}
      speed={speed}
      reduced={reduced}
      interactive
      selected={selected}
      rootRef={rootRef}
      nodeRefs={nodeRefs}
      closeRef={closeRef}
      onPlayPause={() => {
        if (!playing && !sim.loop && tRef.current >= sim.durationMs) setTime(0);
        setPlaying(!playing);
      }}
      onRestart={() => setTime(0)}
      onStep={(dir) => {
        const to = stepTarget(steps, tRef.current, dir);
        setPlaying(false);
        if (to !== null) setTime(to);
      }}
      onSpeed={setSpeed}
      onScenario={(id) => {
        setScenarioId(id);
        setTime(0);
        setSelected(null);
      }}
      onSelect={setSelected}
    />
  );
}
