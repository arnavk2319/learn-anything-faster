import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Use on Pine backgrounds: Paper wordmark and Paper border around the blaze */
  onDark?: boolean;
  /** Mark only, for tight spaces. The name stays available to screen readers. */
  markOnly?: boolean;
};

// Trail-blaze mark + wordmark. Spec: DESIGN.md section 5.
export function Logo({ className, onDark = false, markOnly = false }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-2.5 text-[22px] leading-none font-bold tracking-[-0.3px]",
        onDark ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "bg-highlight inline-block h-5 w-3.5 shrink-0 rounded-[4px] border-2",
          onDark ? "border-primary-foreground" : "border-primary",
        )}
      />
      {markOnly ? <span className="sr-only">{APP_NAME}</span> : APP_NAME}
    </span>
  );
}
