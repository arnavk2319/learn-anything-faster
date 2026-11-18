"use client";
// Anonymous "Was this clear?" feedback (ADR-0017, T-085). The icon shows only the visitor's own vote (read from
// localStorage after mount, so the server HTML is identical for everyone). Renders nothing outside a
// FeedbackScope, so the icon never appears off the item pages. No counts, no names, no client id in the DOM.
import { createPortal } from "react-dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useReducer,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  NOTE_MAX_UI,
  enqueue,
  flushQueue,
  loadState,
  postFeedback,
  saveState,
  setVote,
  targetKey,
  type Rating,
} from "@/lib/learn/feedback/client";
import type { FeedbackTargetKind } from "@/lib/learn/feedback/schemas";
import { initialVote, voteReducer } from "@/lib/learn/feedback/vote";
import { focusRing } from "@/components/ui/tactile";
import { Button } from "@/components/ui/button";

type Scope = { trackId: string; itemId: string };
const FeedbackCtx = createContext<Scope | null>(null);

/** Marks a subtree as feedback-enabled and retries any queued votes on load and when the browser comes online. */
export function FeedbackScope({ trackId, itemId, children }: Scope & { children: ReactNode }) {
  useEffect(() => {
    void flushQueue();
    const on = () => void flushQueue();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, []);
  return <FeedbackCtx.Provider value={{ trackId, itemId }}>{children}</FeedbackCtx.Provider>;
}

/** Wraps a content block with its feedback icon (target id `<itemId>/<blockId>`, as the server expects). */
export function BlockFeedback({ blockId, children }: { blockId: string; children: ReactNode }) {
  const s = useContext(FeedbackCtx);
  if (!s) return <>{children}</>;
  return (
    <div className="flex items-start gap-1" data-block={blockId}>
      <div className="min-w-0 flex-1">{children}</div>
      <FeedbackButton kind="block" targetId={`${s.itemId}/${blockId}`} label="section" />
    </div>
  );
}

const MESSAGES = {
  sending: "Sending…",
  sent: "Thanks, your feedback was sent.",
  queued: "Could not reach the server. Saved on this device and retrying later.",
  limited: "Try again in a minute. Your vote is saved on this device.",
  error: "Could not send. Please try again.",
  retracted: "Your feedback was removed.",
} as const;

const PANEL_W = 288;
const FOCUSABLE = "button:not([disabled]), textarea:not([disabled]), [href]";

function Icon({ vote }: { vote: Rating | null }) {
  const common = {
    viewBox: "0 0 16 16",
    className: "size-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  if (vote === 5)
    return (
      <svg {...common} fill="currentColor">
        <path d="M2.5 7h2.5v6.5H2.5zM6 7l2-4.5c1 0 1.7.8 1.5 1.8L9.2 6h3.3c.8 0 1.4.8 1.2 1.6l-1 4.5c-.2.8-.8 1.4-1.6 1.4H6z" />
      </svg>
    );
  if (vote === 1)
    return (
      <svg {...common} fill="currentColor">
        <path d="M2.5 9h2.5V2.5H2.5zM6 9l2 4.5c1 0 1.7-.8 1.5-1.8L9.2 10h3.3c.8 0 1.4-.8 1.2-1.6l-1-4.5C12.5 3.1 11.9 2.5 11.1 2.5H6z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M2.5 3.5h11v7h-5l-3 2.5v-2.5h-3z" />
    </svg>
  );
}

export function FeedbackButton({
  kind,
  targetId,
  label,
  className = "",
}: {
  kind: FeedbackTargetKind;
  /** Server-side target id; for `block` use useBlockTarget(). */
  targetId: string | null;
  /** What the icon is about, e.g. "question": the accessible name is "Feedback on this question". */
  label: string;
  className?: string;
}) {
  const scope = useContext(FeedbackCtx);
  if (!scope || !targetId) return null;
  return (
    <FeedbackInner
      trackId={scope.trackId}
      kind={kind}
      targetId={targetId}
      label={label}
      className={className}
    />
  );
}

function FeedbackInner({
  trackId,
  kind,
  targetId,
  label,
  className,
}: {
  trackId: string;
  kind: FeedbackTargetKind;
  targetId: string;
  label: string;
  className: string;
}) {
  const key = targetKey(trackId, kind, targetId);
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [s, dispatch] = useReducer(voteReducer, initialVote);
  const root = useRef<HTMLSpanElement>(null);
  const icon = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const last = useRef<Rating | null | "note">(null);

  useEffect(() => {
    dispatch({ type: "load", vote: loadState().votes[key] ?? null });
  }, [key]);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) icon.current?.focus();
  }, []);

  // The panel is portalled to <body> so no pane or stacking context can clip or cover it; placed from the icon.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = icon.current?.getBoundingClientRect();
      if (!r) return;
      const w = Math.min(PANEL_W, window.innerWidth - 16);
      setPos({
        top: r.bottom + 4,
        left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      setPos(null);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const placed = open && pos !== null;
  useEffect(() => {
    if (placed) panel.current?.querySelector<HTMLElement>("button")?.focus();
  }, [placed]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!root.current?.contains(n) && !panel.current?.contains(n)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  async function send(rating: Rating | null, note?: string) {
    last.current = note !== undefined ? "note" : rating;
    if (note === undefined) dispatch({ type: "send", vote: rating });
    else dispatch({ type: "send", vote: 1 });
    let st = loadState();
    if (note === undefined) {
      st = setVote(st, key, rating);
      saveState(st);
    }
    const result = await postFeedback({
      clientId: st.clientId,
      trackId,
      targetKind: kind,
      targetId,
      rating,
      ...(note ? { note } : {}),
    });
    // Only the vote is ever queued, never the note.
    if ((result === "unavailable" || result === "rate_limited") && note === undefined) {
      const cur = loadState();
      saveState({
        ...cur,
        queue: enqueue(
          cur.queue,
          { trackId, targetKind: kind, targetId, rating, at: Date.now() },
          Date.now(),
        ),
      });
    }
    dispatch({ type: "result", result });
    if (result === "ok" && note !== undefined) dispatch({ type: "noteSent" });
  }

  function retry() {
    const l = last.current;
    if (l === "note") void send(1, s.note.trim());
    else void send(l);
  }

  function onKey(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = els[0];
    const lastEl = els[els.length - 1];
    if (!first || !lastEl) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      first.focus();
    }
  }

  const voteName =
    s.vote === 5 ? ", you rated it helpful" : s.vote === 1 ? ", you rated it not helpful" : "";
  const busy = s.status === "sending";
  const failed = s.status === "queued" || s.status === "limited" || s.status === "error";

  return (
    <span ref={root} className={`relative inline-flex ${className}`} onKeyDown={onKey}>
      <button
        ref={icon}
        type="button"
        aria-label={`Feedback on this ${label}${voteName}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="feedback-icon"
        data-vote={s.vote === 5 ? "helpful" : s.vote === 1 ? "not-helpful" : "none"}
        onClick={() => setOpen((o) => !o)}
        className={`hit-area inline-flex size-control-sm shrink-0 items-center justify-center rounded-md border border-transparent hover:bg-lane ${
          s.vote ? "text-primary" : "text-muted-foreground"
        } ${focusRing}`}
      >
        <Icon vote={s.vote} />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panel}
              role="dialog"
              aria-labelledby={`${uid}-t`}
              data-testid="feedback-panel"
              style={
                pos
                  ? ({ "--fb-top": `${pos.top}px`, "--fb-left": `${pos.left}px` } as CSSProperties)
                  : { visibility: "hidden" }
              }
              className="fixed z-50 flex flex-col gap-3 border bg-card p-(--pad-panel) text-card-foreground shadow-2 max-sm:inset-x-0 max-sm:bottom-0 max-sm:rounded-t-lg sm:top-(--fb-top) sm:left-(--fb-left) sm:w-72 sm:rounded-lg"
            >
              <p id={`${uid}-t`} className="font-semibold">
                Was this clear?
              </p>
              <div className="flex gap-2">
                {([5, 1] as const).map((r) => (
                  <Button
                    key={r}
                    variant="secondary"
                    size="md"
                    aria-pressed={s.vote === r}
                    disabled={busy}
                    onClick={() => s.vote !== r && void send(r)}
                    className={`flex-1 ${s.vote === r ? "border-primary bg-lane" : ""}`}
                  >
                    {r === 5 ? "Helpful" : "Not helpful"}
                  </Button>
                ))}
              </div>
              {s.vote === 1 ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-n`} className="text-(length:--text-small)">
                    What was unclear? (optional)
                  </label>
                  <textarea
                    id={`${uid}-n`}
                    value={s.note}
                    maxLength={NOTE_MAX_UI}
                    rows={3}
                    onChange={(e) => dispatch({ type: "note", text: e.target.value })}
                    aria-describedby={`${uid}-c`}
                    className="w-full rounded-md border bg-card p-2 text-(length:--text-ui) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span
                      id={`${uid}-c`}
                      className="text-(length:--text-small) text-muted-foreground"
                    >
                      {NOTE_MAX_UI - s.note.length} characters left
                    </span>
                    <Button
                      size="sm"
                      disabled={busy || s.note.trim() === ""}
                      onClick={() => void send(1, s.note.trim())}
                    >
                      {s.noteSent ? "Note sent" : "Send note"}
                    </Button>
                  </div>
                </div>
              ) : null}
              <p
                role="status"
                aria-live="polite"
                data-testid="feedback-status"
                className="min-h-5 text-(length:--text-small)"
              >
                {s.status === "idle" ? "" : MESSAGES[s.status]}
              </p>
              <div className="flex flex-wrap justify-between gap-2">
                <div className="flex gap-2">
                  {failed ? (
                    <Button size="sm" variant="secondary" onClick={retry}>
                      Retry
                    </Button>
                  ) : null}
                  {s.vote ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void send(null)}
                    >
                      Retract
                    </Button>
                  ) : null}
                </div>
                <Button size="sm" variant="ghost" onClick={() => close(true)}>
                  Close
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
