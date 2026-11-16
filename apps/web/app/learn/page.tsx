import type { Metadata } from "next";
import { SiteHeader } from "@/components/brand/SiteHeader";
import { Landing } from "@/components/learn/Landing";
import { loadLandingTracks } from "@/lib/learn/landing";

export const metadata: Metadata = {
  title: "Learn",
  description: "Pick a track. Each concept has a live diagram you can play, step and inspect.",
};

export default function LearnPage() {
  const tracks = loadLandingTracks();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-4 p-6 sm:p-8">
        <h1 className="font-display text-3xl font-bold">Learn</h1>
        <p className="max-w-xl text-muted-foreground">
          Pick a track. Each concept has a live diagram you can play, step and inspect.
        </p>
        <p data-testid="trust-line" className="max-w-xl text-sm text-muted-foreground">
          Everything here is written from public references and checked by a person before it is
          published. Your progress stays on this device.
        </p>
        <Landing tracks={tracks} />
      </main>
    </>
  );
}
