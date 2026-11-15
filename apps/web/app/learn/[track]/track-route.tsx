// Shared by the track root (Concepts tab) and /problems: metadata and the live / coming-soon split.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComingSoonTrack, TrackPage } from "@/components/learn/TrackPage";
import { contentRoot, loadTrack, loadTrackMeta } from "@/lib/learn/content";
import { getSiteUrl } from "@/lib/site";
import { existsSync, readdirSync } from "node:fs";

export const trackParams = (): { track: string }[] => {
  const root = contentRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((t) => !t.startsWith("_") && loadTrackMeta(t))
    .map((track) => ({ track }));
};

export async function trackMetadata(trackId: string, suffix: string): Promise<Metadata> {
  const track = loadTrackMeta(trackId);
  if (!track) return {};
  return {
    title: suffix ? `${track.title}: ${suffix}` : track.title,
    description: track.summary,
    alternates: { canonical: `${getSiteUrl()}/learn/${trackId}${suffix ? "/problems" : ""}` },
  };
}

export function renderTrack(trackId: string, active: "concepts" | "problems") {
  const meta = loadTrackMeta(trackId);
  if (!meta) notFound();
  if (meta.status !== "live") {
    // Coming-soon: no packs, and no Problems tab either (that URL is a 404).
    if (active === "problems") notFound();
    return <ComingSoonTrack track={meta} />;
  }
  const pack = loadTrack(trackId);
  if (!pack) notFound();
  return <TrackPage pack={pack} active={active} />;
}
