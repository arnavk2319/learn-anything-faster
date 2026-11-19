// Shared tactile feel (ADR-0016 "Balanced"): firm border, soft layered shadow, 1px hover lift, small press.
// Token utilities only. Outside a data-ui="v2" wrapper the shadow and highlight tokens resolve to none/transparent.
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const lift =
  "transition-[transform,translate,scale,box-shadow,background-color,border-color] duration-(--dur-lift) ease-(--ease-out) hover:translate-y-(--lift-y) hover:shadow-[var(--shadow-2),var(--inset-hi)] active:translate-y-(--press-y) active:scale-(--press-scale) active:shadow-none active:duration-(--dur-press)";

export const disabled = "disabled:pointer-events-none disabled:opacity-40";
