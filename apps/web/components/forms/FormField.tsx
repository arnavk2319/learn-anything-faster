import type { ReactNode } from "react";

/** Label + input slot + Danger error text (DESIGN.md section 8, "Invalid input"). */
export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[length:var(--text-ui)] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-[length:var(--text-small)] text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

// Inputs keep a 44px box (the hit-area pseudo-element does not render on inputs); type and radius follow the density tier.
export const inputClass =
  "min-h-(--hit-min) rounded-md border border-input bg-card px-3 text-[length:var(--text-body)] placeholder:text-muted-foreground " +
  "transition-colors duration-(--dur-fast) hover:border-primary focus-visible:border-ring focus-visible:outline-none " +
  "focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive";
