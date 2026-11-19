// The one collapse control of a Learn rail (ADR-0016 amendment 1, section 1): a sidebar-toggle icon in a 44px
// native button. The panel side of the glyph is filled while the rail is expanded and outline-only when collapsed;
// the right rail mirrors it. The tooltip is CSS-only (hover and keyboard focus) and hidden from assistive tech,
// the accessible name is the aria-label.
import { cn } from "@/lib/utils";

export function RailToggle({
  side,
  expanded,
  controls,
  onToggle,
  className,
}: {
  side: "left" | "right";
  expanded: boolean;
  /** Id of the rail body this button shows and hides. */
  controls: string;
  onToggle: () => void;
  className?: string;
}) {
  const noun = side === "left" ? "outline" : "page outline";
  const label = `${expanded ? "Collapse" : "Expand"} ${noun}`;
  const panel =
    side === "left"
      ? "M6.5 4H9v16H6.5A3.5 3.5 0 0 1 3 16.5v-9A3.5 3.5 0 0 1 6.5 4z"
      : "M17.5 4H15v16h2.5a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 17.5 4z";
  const divider = side === "left" ? "M9 4v16" : "M15 4v16";
  return (
    <span className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={controls}
        data-testid={`rail-toggle-${side}`}
        onClick={onToggle}
        className={cn(
          "inline-flex size-(--hit-min) items-center justify-center rounded-mark text-foreground hover:bg-muted",
          "active:bg-[color-mix(in_srgb,var(--muted),var(--primary)_10%)] motion-safe:transition-transform motion-safe:duration-(--dur-press) motion-safe:active:scale-[0.98]",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5 fill-none stroke-current stroke-[1.75] [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <rect x="3" y="4" width="18" height="16" rx="3.5" />
          <path d={panel} className={expanded ? "fill-current" : "fill-none stroke-none"} />
          <path d={divider} />
        </svg>
      </button>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none invisible absolute top-1/2 z-30 -translate-y-1/2 rounded-mark bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background",
          side === "left" ? "left-full ml-1" : "right-full mr-1",
          "group-hover:visible group-has-[:focus-visible]:visible",
        )}
      >
        {label}
      </span>
    </span>
  );
}
