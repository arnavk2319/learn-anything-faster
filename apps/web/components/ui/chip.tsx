import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { focusRing, lift } from "./tactile";

const base =
  "inline-flex items-center gap-1 rounded-pill border border-border-firm px-2.5 text-[length:var(--text-small)] font-medium";

/** Static label chip. */
export function Chip({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn(base, "h-6 bg-lane text-foreground", className)} {...props} />;
}

/** Toggle chip (filters). Pass `pressed`; it renders aria-pressed. */
export function ChipButton({
  className,
  pressed = false,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        base,
        "hit-area h-control-sm bg-card shadow-1 hover:bg-lane",
        pressed && "border-transparent bg-highlight text-highlight-foreground",
        focusRing,
        lift,
        className,
      )}
      {...props}
    />
  );
}
