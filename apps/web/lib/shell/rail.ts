// Pure width and preference logic for the Learn shell (ADR-0016 section 8). No React, no DOM.
// The left rail width is stored as a fraction of the longest outline label, so a font or density change
// cannot strand a stored value. 1 shows the longest label in full; 0.8 shows at least 80% of it.
import { z } from "zod";

export const UI_STORAGE_KEY = "laf:ui:v1";
export const UI_VERSION = 1;
export const MIN_FRACTION = 0.8;
export const DEFAULT_FRACTION = 1;
export const STEP = 8;
export const STEP_SHIFT = 32;

/** Measured px: width of the longest label's text and the constant chrome around it (padding, dot, gutter, border). */
export interface RailMetrics {
  label: number;
  chrome: number;
}
export interface RailBounds {
  min: number;
  max: number;
}

export function railBounds(m: RailMetrics): RailBounds {
  return {
    min: Math.ceil(m.chrome + MIN_FRACTION * m.label),
    max: Math.ceil(m.chrome + m.label),
  };
}

export function clampWidth(w: number, b: RailBounds): number {
  if (!Number.isFinite(w)) return b.max;
  return Math.min(b.max, Math.max(b.min, Math.round(w)));
}

/** Clamp to [MIN_FRACTION, 1]; anything that is not a finite number falls back to the default. */
export function clampFraction(f: unknown): number {
  if (typeof f !== "number" || !Number.isFinite(f)) return DEFAULT_FRACTION;
  return Math.min(1, Math.max(MIN_FRACTION, f));
}

export function widthFromFraction(f: number, m: RailMetrics): number {
  return clampWidth(m.chrome + clampFraction(f) * m.label, railBounds(m));
}

export function fractionFromWidth(w: number, m: RailMetrics): number {
  if (m.label <= 0) return DEFAULT_FRACTION;
  return clampFraction((w - m.chrome) / m.label);
}

export type RailAction =
  | { type: "step"; dir: -1 | 1; shift?: boolean }
  | { type: "min" }
  | { type: "max" }
  | { type: "set"; width: number };

export function railReducer(width: number, action: RailAction, b: RailBounds): number {
  switch (action.type) {
    case "step":
      return clampWidth(width + action.dir * (action.shift ? STEP_SHIFT : STEP), b);
    case "min":
      return b.min;
    case "max":
      return b.max;
    case "set":
      return clampWidth(action.width, b);
  }
}

export interface UiPrefs {
  rail: number;
  rightCollapsed: boolean;
}
export const DEFAULT_PREFS: UiPrefs = { rail: DEFAULT_FRACTION, rightCollapsed: false };

/** Collapse flags and the roadmap hint flag live beside `UiPrefs` in the same envelope (ADR-0016 amendment 1).
 * Kept out of `UiPrefs` so `readUiPrefs` keeps its shape; every flag is additive, version stays 1. */
export interface ExtraPrefs {
  leftCollapsed: boolean;
  graphHintDismissed: boolean;
}
export const DEFAULT_EXTRA: ExtraPrefs = { leftCollapsed: false, graphHintDismissed: false };

const Envelope = z.looseObject({ v: z.literal(UI_VERSION) });

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function readRaw(storage: StorageLike | null): Record<string, unknown> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(UI_STORAGE_KEY);
    if (!raw) return null;
    const r = Envelope.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Never throws: missing, corrupt or wrong-version data yields the defaults; the fraction is clamped. */
export function readUiPrefs(storage: StorageLike | null): UiPrefs {
  const d = readRaw(storage);
  if (!d) return { ...DEFAULT_PREFS };
  return {
    rail: clampFraction(d.rail),
    rightCollapsed: typeof d.rightCollapsed === "boolean" ? d.rightCollapsed : false,
  };
}

/** Missing, corrupt or non-boolean values fall back to the defaults (rails expanded, hint shown). */
export function readExtraPrefs(storage: StorageLike | null): ExtraPrefs {
  const d = readRaw(storage);
  if (!d) return { ...DEFAULT_EXTRA };
  return {
    leftCollapsed: typeof d.leftCollapsed === "boolean" ? d.leftCollapsed : false,
    graphHintDismissed: typeof d.graphHintDismissed === "boolean" ? d.graphHintDismissed : false,
  };
}

/** Merges into the stored object so keys owned by other features survive. */
export function writeUiPrefs(
  patch: Partial<UiPrefs & ExtraPrefs>,
  storage: StorageLike | null,
): void {
  if (!storage) return;
  try {
    const next = { ...(readRaw(storage) ?? {}), ...patch, v: UI_VERSION };
    storage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the preference just is not remembered.
  }
}

/** "Celebrations" switch (ADR-0016 section 7): stamps and bursts on reward toasts. On unless explicitly false. */
export function readCelebrations(storage: StorageLike | null): boolean {
  return readRaw(storage)?.celebrations !== false;
}

export function writeCelebrations(on: boolean, storage: StorageLike | null): void {
  if (!storage) return;
  try {
    const next = { ...(readRaw(storage) ?? {}), celebrations: on, v: UI_VERSION };
    storage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not remembered.
  }
}
