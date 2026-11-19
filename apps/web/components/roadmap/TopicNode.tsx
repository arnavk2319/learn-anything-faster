"use client";
// Topic pill (DESIGN.md section 8, ADR-0016 amendment 1). The button is the tab stop: Tab focuses it, Enter or click selects.
import { Check, ChevronRight, Flag } from "lucide-react";
import { Handle, Position, useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import { cn } from "../../lib/utils";
import { focusRing } from "../ui/tactile";
import { selectTopic, useSelectedTopicId } from "../../lib/roadmap/selection-store";

interface TopicData {
  name: string;
  covered: boolean;
  area: string;
  startHere?: boolean;
  /** First / last topic in route order (computed in layout.ts). */
  isStart?: boolean;
  isGoal?: boolean;
  [key: string]: unknown;
}

export function TopicNode({ id, data }: NodeProps) {
  const d = data as TopicData;
  const selected = useSelectedTopicId() === id;
  const rf = useReactFlow();
  const vw = useStore((s) => s.width);
  const vh = useStore((s) => s.height);

  // Keyboard focus can land off screen: pan the node into view.
  const reveal = () => {
    const n = rf.getInternalNode(id);
    if (!n) return;
    const { x, y, zoom } = rf.getViewport();
    const w = n.measured.width ?? 0;
    const h = n.measured.height ?? 0;
    const ax = n.internals.positionAbsolute.x;
    const ay = n.internals.positionAbsolute.y;
    const left = ax * zoom + x;
    const top = ay * zoom + y;
    if (left >= 0 && top >= 0 && left + w * zoom <= vw && top + h * zoom <= vh) return;
    void rf.setCenter(ax + w / 2, ay + h / 2, { zoom, duration: 320 });
  };

  return (
    <>
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0!" />
      <button
        type="button"
        aria-pressed={selected}
        // Start/Goal/"Start here" pills are real text inside the button, so the content names it (an aria-label
        // would trip label-content-name-mismatch); covered nodes name the state instead.
        aria-label={d.covered ? `${d.name}, you already know this` : undefined}
        title={d.name}
        data-topic-id={id}
        data-selected={selected}
        onClick={() => selectTopic(id)}
        onFocus={reveal}
        className={cn(
          // States: new = dashed firm border, known = Trail border, start = 2px Pine border, selected = Blaze + Pine.
          // Hover lift (1px, --shadow-lift) and press live on this inner button, never on .react-flow__node;
          // reduced motion zeroes --dur-lift, --lift-y and --press-*.
          "group pointer-events-auto relative flex h-full w-full cursor-pointer items-center gap-2 rounded-pill border-[1.5px] pr-2 pl-3 text-left text-(length:--text-body) font-medium shadow-[var(--shadow-rest)]",
          "transition-[transform,translate,scale,box-shadow,background-color,border-color] duration-(--dur-lift) ease-(--ease-out)",
          "hover:translate-y-(--lift-y) hover:shadow-[var(--shadow-lift)] active:translate-y-(--press-y) active:scale-(--press-scale) active:shadow-[var(--shadow-press)] active:duration-(--dur-press)",
          focusRing,
          "hover:border-primary",
          d.covered
            ? "border-route bg-known text-known-foreground"
            : "border-dashed border-input bg-card text-foreground",
          d.isStart && !d.covered && "border-2 border-solid border-foreground",
          selected && "border-solid border-primary bg-highlight text-highlight-foreground",
        )}
      >
        {d.isStart && (
          <span className="pointer-events-none absolute -top-3 left-3 flex h-[22px] items-center rounded-pill border border-foreground bg-card px-2 text-(length:--text-small) font-bold text-foreground uppercase">
            Start
          </span>
        )}
        {d.isGoal && (
          <span className="pointer-events-none absolute -top-3 right-3 flex h-[22px] items-center gap-1 rounded-pill border border-foreground bg-primary px-2 text-(length:--text-small) font-bold text-primary-foreground uppercase">
            <Flag aria-hidden="true" className="size-3" />
            Goal
          </span>
        )}
        {d.covered && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-pill border border-card bg-route text-primary-foreground"
          >
            <Check className="size-3" />
          </span>
        )}
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 shrink-0 rounded-pill border",
            d.covered ? "border-route bg-route" : "border-muted-foreground bg-card",
            selected && !d.covered && "border-primary bg-transparent ring-1 ring-primary",
          )}
        />
        <span className="truncate group-hover:underline">{d.name}</span>
        {d.startHere && (
          <span className="ml-auto shrink-0 rounded-sm border border-primary px-1 text-(length:--text-small) font-semibold">
            Start here
          </span>
        )}
        <ChevronRight
          aria-hidden="true"
          data-affordance="chevron"
          className={cn(
            "size-4 shrink-0 text-muted-foreground group-hover:text-foreground",
            !d.startHere && "ml-auto",
            selected && "text-highlight-foreground",
          )}
        />
      </button>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="opacity-0!"
      />
    </>
  );
}
