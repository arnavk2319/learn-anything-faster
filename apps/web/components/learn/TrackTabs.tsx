"use client";
// Concepts / Problems tabs. Each tab is a real link to its own URL (Concepts is the track root), so the active
// tab lives in the URL and survives reload and back/forward. Rendering is the shared T-078 Tabs primitive.
import { Tabs, type TabItem } from "@/components/ui/tabs";

export type TabDef = TabItem & { count: number; href: string };

export function TrackTabs({ tabs, active }: { tabs: TabDef[]; active: string }) {
  return <Tabs tabs={tabs} active={active} label="Track sections" panelId="track-panel" />;
}
