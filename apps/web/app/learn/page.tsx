import type { Metadata } from "next";
import { Landing } from "@/components/learn/Landing";
import { LearnShell } from "@/components/shell/LearnShell";
import { loadLandingTracks } from "@/lib/learn/landing";
import type { OutlineGroup } from "@/lib/shell/outline";

export const metadata: Metadata = {
  title: "Learn",
  description: "Pick a track. Each concept has a live diagram you can play, step and inspect.",
};

export default function LearnPage() {
  const tracks = loadLandingTracks();
  // The shell rail lists the live tracks here (there is no single track to outline yet).
  const groups: OutlineGroup[] = [
    {
      key: "tracks",
      label: "Tracks",
      items: tracks
        .filter((t) => t.status === "live")
        .map((t) => ({
          kind: "track" as const,
          id: t.id,
          title: t.title,
          href: `/learn/${t.id}`,
          quickCheckIds: [],
        })),
    },
  ].filter((g) => g.items.length > 0);
  return (
    <LearnShell groups={groups} currentId="" next={[]}>
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-3 p-4 md:p-5">
        <h1 className="font-display font-bold">Learn</h1>
        <p className="max-w-xl text-muted-foreground">
          Pick a track. Each concept has a live diagram you can play, step and inspect.
        </p>
        <p
          data-testid="trust-line"
          className="max-w-xl text-(length:--text-small) text-muted-foreground"
        >
          Everything here is written from public references and checked by a person before it is
          published. Your progress stays on this device.
        </p>
        <Landing tracks={tracks} />
      </div>
    </LearnShell>
  );
}
