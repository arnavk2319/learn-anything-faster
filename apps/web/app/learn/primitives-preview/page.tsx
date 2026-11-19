import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, ChipButton } from "@/components/ui/chip";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";

// T-078 e2e fixture for the tactile primitives. Not linked, not indexed.
export const metadata: Metadata = {
  title: "Primitives preview",
  robots: { index: false, follow: false },
};

const sizes = ["sm", "md", "lg"] as const;
const variants = ["primary", "secondary", "ghost", "destructive"] as const;
const tabs = [
  { id: "a", label: "Concepts", count: 4 },
  { id: "b", label: "Problems", count: 2 },
  { id: "c", label: "Questions" },
];

export default function PrimitivesPreviewPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="font-display">Primitives</h1>
      <div
        data-ui="v2"
        data-density="compact"
        data-testid="v2"
        className="space-y-4 bg-background p-4"
      >
        {sizes.map((s) => (
          <div key={s} className="flex flex-wrap items-center gap-4">
            {variants.map((v) => (
              <Button key={v} variant={v} size={s} data-sample={`${v}-${s}`}>
                {v} {s}
              </Button>
            ))}
          </div>
        ))}
        <Button data-sample="disabled" disabled>
          Disabled
        </Button>
        <Card data-sample="card">Card body</Card>
        <div className="flex items-center gap-4">
          <Chip data-sample="chip">Added by us</Chip>
          <ChipButton data-sample="chip-button" pressed>
            Filter
          </ChipButton>
        </div>
        <Tabs tabs={tabs} active="a" label="Sample tabs" panelId="sample-panel" />
        <div id="sample-panel" role="tabpanel" aria-labelledby="tab-a" />
        <div className="flex items-center gap-4">
          <ProgressRing value={38} size="sm" label="38% done" data-testid="ring-sm" />
          <ProgressRing value={38} size="md" label="38% done (md)" data-testid="ring-md" />
          <ProgressRing value={38} size="lg" label="38% done (lg)" data-testid="ring-lg" />
          <ProgressBar value={60} label="60% done" data-testid="bar" />
        </div>
      </div>
    </main>
  );
}
