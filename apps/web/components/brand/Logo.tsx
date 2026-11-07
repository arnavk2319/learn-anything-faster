import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Use on Pine backgrounds: Paper wordmark and Paper border around the blaze */
  onDark?: boolean;
  /** Mark only, for tight spaces. The name stays available to screen readers. */
  markOnly?: boolean;
};

// Trail-blaze mark + wordmark. Spec: DESIGN.md section 5. The name comes from APP_NAME via SITE_NAME.
export function Logo({ className, onDark = false, markOnly = false }: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-display text-[22px] leading-none font-bold tracking-[-0.3px]",
        onDark ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative top-[3px] inline-block h-5 w-3.5 shrink-0 rounded-mark border-2 bg-highlight",
          onDark ? "border-primary-foreground" : "border-primary",
        )}
      />
      {markOnly ? <span className="sr-only">{SITE_NAME}</span> : SITE_NAME}
    </span>
  );
}
