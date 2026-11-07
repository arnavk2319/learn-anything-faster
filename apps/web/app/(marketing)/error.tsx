"use client";
import { LandingError } from "@/components/landing/LandingStates";

export default function MarketingError({ reset }: { error: Error; reset: () => void }) {
  return <LandingError onRetry={reset} />;
}
