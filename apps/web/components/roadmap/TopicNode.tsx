"use client";
// Topic pill (DESIGN.md section 8). The button is the tab stop: Tab focuses it, Enter or click selects.
import { Handle, Position, useReactFlow, useStore, type NodeProps } from "@xyflow/react";
import { cn } from "../../lib/utils";
import { selectTopic, useSelectedTopicId } from "../../lib/roadmap/selection-store";

interface TopicData {
  name: string;
  covered: boolean;
  area: string;
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
        aria-label={d.covered ? `${d.name}, you already know this` : d.name}
        title={d.name}
        data-topic-id={id}
        data-selected={selected}
        onClick={() => selectTopic(id)}
        onFocus={reveal}
        className={cn(
          "pointer-events-auto flex h-10 w-full cursor-pointer items-center gap-2 rounded-pill border px-3 text-left text-sm font-medium transition-[border-color,background-color,transform] duration-[var(--dur-fast)] ease-trail active:scale-[0.98]",
          "hover:border-primary",
          d.covered
            ? "border-route bg-known text-known-foreground"
            : "border-[color:var(--bark)] bg-card text-foreground",
          selected && "border-[1.5px] border-primary bg-highlight text-highlight-foreground",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2.5 shrink-0 rounded-pill border",
            d.covered ? "border-route bg-route" : "border-primary bg-card",
            selected && !d.covered && "bg-highlight ring-1 ring-primary",
          )}
        />
        <span className="truncate">{d.name}</span>
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
