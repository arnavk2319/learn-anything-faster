import { cn } from "@/lib/utils";
import type { RoutePreview } from "@/lib/landing-preview";

type RouteLineProps = {
  preview: RoutePreview;
  /** live: mapped move. unmapped: the chosen move is not curated yet (muted line, no stops). */
  state?: "live" | "unmapped";
  fromName?: string;
  toName?: string;
};

// Landing trail with stops (DESIGN.md section 12). Horizontal from md, vertical list below.
export function RouteLine({ preview, state = "live", fromName, toName }: RouteLineProps) {
  const live = state === "live";
  const mid = live
    ? preview.stops.map((s) => ({ key: s.id, name: s.name, sub: `${s.topics} topics` }))
    : [{ key: "unmapped", name: "Not mapped yet", sub: "" }];
  return (
    <div data-testid="route-line" data-state={state} className="relative">
      <div
        aria-hidden="true"
        data-muted={live ? undefined : "true"}
        className="trail-line absolute top-4 right-2 left-2 hidden md:block"
      />
      <ol className="relative flex flex-col gap-5 md:flex-row md:justify-between md:gap-0">
        <Stop
          end
          name={fromName ?? preview.fromName}
          sub="You are here"
          tone="from"
          live={live}
          align="start"
        />
        {mid.map((m) => (
          <Stop key={m.key} name={m.name} sub={m.sub} tone="mid" live={live} align="center" />
        ))}
        <Stop
          end
          name={toName ?? preview.toName}
          sub={live ? `About ${preview.hours} hours of learning` : "Request it to get it mapped"}
          tone="to"
          live={live}
          align="end"
        />
      </ol>
    </div>
  );
}

function Stop(props: {
  name: string;
  sub: string;
  tone: "from" | "mid" | "to";
  live: boolean;
  align: "start" | "center" | "end";
  end?: boolean;
}) {
  const { name, sub, tone, live, align, end } = props;
  const dot = cn(
    "box-border shrink-0 rounded-pill border-4",
    end ? "size-9" : "mt-2 size-5",
    tone === "to" && live ? "bg-highlight" : "bg-card",
    !live ? "border-border" : tone === "mid" ? "border-route" : "border-primary",
  );
  return (
    <li
      className={cn(
        "flex items-start gap-3 md:w-37.5 md:flex-col",
        align === "center" && "md:items-center md:text-center",
        align === "end" && "md:items-end md:text-right",
      )}
    >
      <span aria-hidden="true" className={dot} />
      <span className="flex flex-col">
        <span className={cn("text-[15px] text-foreground", end ? "font-semibold" : "font-medium")}>
          {name}
        </span>
        {sub ? <span className="text-[13px] text-muted-foreground">{sub}</span> : null}
      </span>
    </li>
  );
}
