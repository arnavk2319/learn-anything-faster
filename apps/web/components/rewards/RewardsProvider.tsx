"use client";
// Reward bus and toast region (ADR-0016 section 7). Non-blocking: a polite status region that exists from first
// render, never takes focus, auto-dismisses after 4s (hover or focus pauses it), Escape dismisses, and a newer
// toast replaces the older. Outside a provider every call is a no-op, so blocks can be used anywhere.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePrefersReducedMotion } from "@/lib/roadmap/use-prefers-reduced-motion";
import { readCelebrations, writeCelebrations } from "@/lib/shell/rail";
import {
  burstAllowed,
  conceptJustFinished,
  correctRewards,
  type Reward,
} from "@/lib/learn/rewards";
import type { Progress } from "@/lib/learn/progress";
import { focusRing } from "@/components/ui/tactile";

export interface ConceptContext {
  id: string;
  title: string;
  quickCheckIds: string[];
  next?: { href: string; title: string };
}

interface Bus {
  /** Show a toast directly (first-opened). */
  notify: (r: Reward) => void;
  /** An answer was saved: derives the correct and finished rewards. */
  answered: (a: {
    before: Progress;
    after: Progress;
    questionId: string;
    correct: boolean;
  }) => void;
  setConcept: (c: ConceptContext | null) => void;
}
interface Celebrations {
  celebrations: boolean;
  setCelebrations: (on: boolean) => void;
}

const NOOP: Bus = {
  notify: () => {},
  answered: () => {},
  setConcept: () => {},
};
const CELEBRATIONS_OFF: Celebrations = { celebrations: true, setCelebrations: () => {} };

const RewardsContext = createContext<Bus>(NOOP);
const CelebrationsContext = createContext<Celebrations>(CELEBRATIONS_OFF);
export const useRewards = () => useContext(RewardsContext);

const DISMISS_MS = 4000;
let toastSeq = 0;
interface Shown extends Reward {
  key: number;
  burstNow: boolean;
}

function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function RewardsProvider({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [celebrations, setCelebrationsState] = useState(true);
  const [toast, setToast] = useState<Shown | null>(null);
  const concept = useRef<ConceptContext | null>(null);
  const lastBurst = useRef<number | null>(null);
  const celebrationsRef = useRef(true);

  useEffect(() => {
    const on = readCelebrations(localStore());
    celebrationsRef.current = on;
    setCelebrationsState(on);
  }, []);

  const show = useCallback((r: Reward) => {
    const now = Date.now();
    const canBurst =
      r.burst &&
      celebrationsRef.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      burstAllowed(lastBurst.current, now);
    if (canBurst) lastBurst.current = now;
    setToast({ ...r, key: ++toastSeq, burstNow: canBurst });
  }, []);

  const bus = useMemo<Bus>(
    () => ({
      notify: show,
      answered: ({ before, after, questionId, correct }) => {
        const c = concept.current;
        if (c && conceptJustFinished(before, after, c)) {
          show({
            kind: "finished",
            title: `${c.title} done`,
            ...(c.next ? { link: { href: c.next.href, label: `Next: ${c.next.title}` } } : {}),
            burst: true,
          });
          return;
        }
        if (correctRewards(before.answers[questionId]?.correct, correct)) {
          show({ kind: "correct", title: "Correct", burst: true });
        }
      },
      setConcept: (c) => {
        concept.current = c;
      },
    }),
    [show],
  );
  const cel = useMemo<Celebrations>(
    () => ({
      celebrations,
      setCelebrations: (on) => {
        celebrationsRef.current = on;
        setCelebrationsState(on);
        writeCelebrations(on, localStore());
      },
    }),
    [celebrations],
  );

  return (
    <RewardsContext.Provider value={bus}>
      <CelebrationsContext.Provider value={cel}>
        {children}
        <ToastRegion
          toast={toast}
          stamp={celebrations}
          reduced={reduced}
          onDismiss={() => setToast(null)}
        />
      </CelebrationsContext.Provider>
    </RewardsContext.Provider>
  );
}

function Stamp({ animate }: { animate: boolean }) {
  return (
    <span
      data-testid="reward-stamp"
      aria-hidden="true"
      className={`flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground ${animate ? "reward-stamp" : ""}`}
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M3.5 8.5l3 3 6-6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

const DOT_COLORS = ["bg-primary", "bg-ring", "bg-highlight"] as const;

/** One-shot burst: 12 CSS dots, decorative. Not rendered at all when motion is not allowed. */
export function Burst() {
  return (
    <span
      data-testid="reward-burst"
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 size-0"
    >
      {Array.from({ length: 12 }, (_, i) => (
        <span
          key={i}
          className={`reward-dot absolute -top-0.5 -left-0.5 size-1 rounded-full ${DOT_COLORS[i % 3]}`}
        />
      ))}
    </span>
  );
}

function ToastRegion({
  toast,
  stamp,
  reduced,
  onDismiss,
}: {
  toast: Shown | null;
  stamp: boolean;
  reduced: boolean;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const key = toast?.key;

  useEffect(() => setPaused(false), [key]);

  useEffect(() => {
    if (key === undefined || paused) return;
    const t = setTimeout(onDismiss, DISMISS_MS);
    return () => clearTimeout(t);
  }, [key, paused, onDismiss]);

  useEffect(() => {
    if (key === undefined) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="reward-region"
      className="pointer-events-none fixed bottom-[calc(var(--bottom-nav-h)+1rem)] left-4 z-50 max-w-[calc(100vw-2rem)] md:bottom-4"
    >
      {toast ? (
        <div
          key={toast.key}
          data-testid="reward-toast"
          data-reward={toast.kind}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className="pointer-events-auto relative flex items-center gap-3 rounded-lg border border-border-firm bg-card px-3 py-2 text-(length:--text-ui) text-card-foreground shadow-(--shadow-2)"
        >
          {stamp ? <Stamp animate={!reduced} /> : null}
          {toast.burstNow && !reduced ? <Burst /> : null}
          <span className="font-semibold">{toast.title}</span>
          {toast.link ? (
            <Link href={toast.link.href} className={`text-primary underline ${focusRing}`}>
              {toast.link.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** "Celebrations" switch (ADR-0016 section 7). Stamps and bursts only; toasts always show. */
export function CelebrationsSwitch() {
  const { celebrations, setCelebrations } = useContext(CelebrationsContext);
  return (
    <label className="mt-3 flex min-h-(--hit-min) items-center gap-2 text-(length:--text-small) text-muted-foreground lg:min-h-8">
      <input
        type="checkbox"
        checked={celebrations}
        onChange={(e) => setCelebrations(e.target.checked)}
      />
      Celebrations
    </label>
  );
}
