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
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass =
  "h-11 rounded-[10px] border border-input bg-card px-3 text-base placeholder:text-muted-foreground " +
  "transition-colors duration-150 hover:border-primary focus-visible:border-ring focus-visible:outline-none " +
  "focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive";

export const buttonClass =
  "h-11 rounded-[10px] bg-primary px-6 font-semibold text-primary-foreground transition-colors duration-150 " +
  "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-40";
