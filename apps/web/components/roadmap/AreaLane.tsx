"use client";
// Compound node: an area lane with a collapsible header. Collapsed shows a right arrow, expanded a down arrow.
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface LaneData {
  areaKey: string;
  label: string;
  covered: boolean;
  collapsed: boolean;
  count: number;
  onToggle?: (areaKey: string) => void;
  [key: string]: unknown;
}

export function AreaLane({ data }: NodeProps) {
  const d = data as LaneData;
  const Icon = d.collapsed ? ChevronRight : ChevronDown;
  return (
    <div className="h-full w-full rounded-lane bg-lane">
      <Handle type="target" position={Position.Left} isConnectable={false} className="opacity-0!" />
      <button
        type="button"
        aria-expanded={!d.collapsed}
        aria-label={`${d.label}, ${d.count} ${d.count === 1 ? "topic" : "topics"}`}
        data-area={d.areaKey}
        onClick={() => d.onToggle?.(d.areaKey)}
        className={cn(
          "pointer-events-auto flex h-12 w-full cursor-pointer items-center gap-2 rounded-lane px-4 text-left transition-colors duration-[var(--dur-fast)] hover:bg-card/60",
          d.covered ? "text-route" : "text-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate font-display text-base font-semibold">{d.label}</span>
        <span className="ml-auto text-sm text-muted-foreground">{d.count}</span>
      </button>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="opacity-0!"
      />
    </div>
  );
}
