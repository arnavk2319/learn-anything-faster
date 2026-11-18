"use client";
// Slots the Learn shell exposes to page content (T-080). Null outside the shell (e.g. /learn/sim-preview),
// where consumers fall back to rendering in place.
import { createContext, useContext } from "react";

export interface ShellSlots {
  /** Right-rail slot (data-shell-slot="inspector") for the sim inspector. */
  inspector: HTMLElement | null;
  /** Right-rail slot (data-shell-slot="onpage") for the in-page heading outline. */
  onPage: HTMLElement | null;
  /** Expand the right rail without persisting the preference (so an opening inspector is visible). */
  expandRight: () => void;
}

export const ShellSlotsContext = createContext<ShellSlots | null>(null);
export const useShellSlots = () => useContext(ShellSlotsContext);
