import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

type A11y = { label: string; className?: string; "data-testid"?: string };

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** Conic progress ring. `value` is 0..100. `sm` has no centre label. */
export function ProgressRing({
  value,
  label,
  size = "md",
  className,
  "data-testid": testId,
}: A11y & { value: number; size?: "sm" | "md" | "lg" }) {
  const pct = clamp(value);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid={testId}
      style={{ "--p": pct } as CSSProperties}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-pill bg-[conic-gradient(var(--route)_calc(var(--p)*1%),var(--border)_0)] before:absolute before:rounded-pill before:bg-card before:content-['']",
        size === "lg" && "size-(--ring-lg) before:inset-(--ring-thickness)",
        size === "md" && "size-(--ring-md) before:inset-[calc(var(--ring-thickness)*0.6)]",
        size === "sm" && "size-(--ring-sm) before:inset-[calc(var(--ring-thickness)*0.6)]",
        className,
      )}
    >
      {size === "sm" ? null : (
        <b
          className={cn(
            "relative font-semibold tabular-nums",
            size === "lg" ? "text-base" : "text-xs",
          )}
        >
          {pct}%
        </b>
      )}
    </span>
  );
}

/** Horizontal progress bar. `value` is 0..100. */
export function ProgressBar({
  value,
  label,
  className,
  "data-testid": testId,
}: A11y & { value: number }) {
  const pct = clamp(value);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid={testId}
      style={{ "--p": pct } as CSSProperties}
      className={cn("block h-1.5 w-24 shrink-0 overflow-hidden rounded-pill bg-border", className)}
    >
      <i className="block h-full w-[calc(var(--p)*1%)] bg-route transition-[width] duration-(--dur-base) ease-(--ease-out)" />
    </span>
  );
}
