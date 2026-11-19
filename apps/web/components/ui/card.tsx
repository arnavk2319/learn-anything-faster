import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Panel surface: firm border, soft shadow. `interactive` adds the hover lift (use on cards that are links). */
export function Card({
  className,
  interactive = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-firm bg-card p-(--pad-panel) text-card-foreground shadow-1",
        interactive &&
          "transition-[translate,box-shadow] duration-(--dur-lift) ease-(--ease-out) hover:translate-y-(--lift-y) hover:shadow-2",
        className,
      )}
      {...props}
    />
  );
}
