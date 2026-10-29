"use client";
// Copy-link control. Copies the canonical absolute /roadmap/<from>/<to> URL. If the clipboard API
// is missing or rejects, the URL is shown in a read-only field, selected, so it can be copied by hand.
import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EVENTS, track } from "../../lib/analytics";

const btn =
  "border-border hover:border-input hover:bg-lane bg-card text-foreground inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors duration-[var(--dur-fast)] active:scale-[0.98]";

export function ShareLink({ from, to }: { from: string; to: string }) {
  const [state, setState] = useState<"idle" | "copied" | "fallback">("idle");
  const [url, setUrl] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state === "fallback") input.current?.select();
  }, [state]);

  async function copy() {
    const link = `${window.location.origin}/roadmap/${from}/${to}`;
    setUrl(link);
    try {
      await navigator.clipboard.writeText(link);
      setState("copied");
      track(EVENTS.shareLinkCopied, { from, to });
    } catch {
      setState("fallback");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn} onClick={() => void copy()}>
        {state === "copied" ? (
          <Check aria-hidden="true" className="size-4 text-route" />
        ) : (
          <Link2 aria-hidden="true" className="size-4" />
        )}
        Copy link
      </button>
      {state === "fallback" && (
        <input
          ref={input}
          readOnly
          aria-label="Roadmap link"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 w-72 max-w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
        />
      )}
      <span role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {state === "copied" ? "Link copied" : state === "fallback" ? "Copy the link below" : ""}
      </span>
    </div>
  );
}
