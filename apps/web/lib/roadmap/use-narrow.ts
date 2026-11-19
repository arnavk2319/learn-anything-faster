"use client";
// Below 768px (Tailwind md) the roadmap is list-only and the graph is not mounted at all (ADR-0016
// amendment 1). The server snapshot is "narrow" so the graph and its worker never start before the
// client knows the real width; wide screens briefly show the list, then swap to the graph.
import { useSyncExternalStore } from "react";

const NARROW = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(NARROW);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export const useNarrowScreen = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(NARROW).matches,
    () => true,
  );
