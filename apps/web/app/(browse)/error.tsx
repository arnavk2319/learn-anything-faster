"use client";
import { LandingError } from "@/components/landing/LandingStates";

export default function BrowseError({ reset }: { error: Error; reset: () => void }) {
  return <LandingError onRetry={reset} />;
}
