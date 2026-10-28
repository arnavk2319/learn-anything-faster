// URL-free selection store for the roadmap graph. One selected topic at most (DESIGN.md section 8).
// T-011's topic panel attaches with `useSelectedTopicId()` (React) or `subscribeSelection` /
// `getSelectedTopicId` (anything else), and may call `selectTopic` (for example from a chip).
import { useSyncExternalStore } from "react";

let selected: string | null = null;
const listeners = new Set<() => void>();

export const getSelectedTopicId = () => selected;

export function selectTopic(id: string | null): void {
  if (id === selected) return;
  selected = id;
  for (const l of listeners) l();
}

export function subscribeSelection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSelectedTopicId(): string | null {
  return useSyncExternalStore(subscribeSelection, getSelectedTopicId, () => null);
}
