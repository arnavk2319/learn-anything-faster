"use client";
// Cloudflare Turnstile widget (ADR-0012). No npm dependency: one script element, explicit render. The token is
// written to a controlled hidden input named `cf-turnstile-response` so it arrives in the FormData.
// `resetKey` changes after every submit result; tokens are single use, so the widget is reset then.
import { useCallback, useEffect, useRef, useState } from "react";
import { siteKey } from "../../lib/forms/turnstile-keys";

type Api = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: Api;
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Api> | null = null;
function loadApi(): Promise<Api> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no api")));
    s.onerror = () => reject(new Error("blocked"));
    document.head.appendChild(s);
  });
  loading.catch(() => {
    loading = null; // allow Retry to load again
  });
  return loading;
}

export const BLOCKED_COPY = "We couldn't verify you're human. Reload the challenge and try again.";

export function TurnstileWidget({ action, resetKey }: { action: string; resetKey?: unknown }) {
  const slot = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Pages like the catalog hold many forms; only forms near the viewport load a challenge.
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = slot.current;
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      (e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let dead = false;
    const key = siteKey();
    if (!key) {
      setFailed(true);
      return;
    }
    setFailed(false);
    loadApi()
      .then((api) => {
        if (dead || !slot.current) return;
        id.current = api.render(slot.current, {
          sitekey: key,
          action,
          "response-field": false,
          callback: (t: string) => {
            setToken(t);
            setFailed(false);
          },
          "expired-callback": () => {
            setToken("");
            setFailed(true);
          },
          "error-callback": () => {
            setToken("");
            setFailed(true);
          },
        });
      })
      .catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [action, attempt, near]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setToken("");
    if (id.current) window.turnstile?.reset(id.current);
  }, [resetKey]);

  const retry = useCallback(() => {
    setToken("");
    if (id.current && window.turnstile) {
      setFailed(false);
      window.turnstile.reset(id.current);
    } else setAttempt((n) => n + 1);
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <input type="hidden" name="cf-turnstile-response" value={token} readOnly />
      {/* Reserved height so the widget loading does not shift the layout. */}
      <div ref={slot} className="min-h-[65px]" />
      {failed ? (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            {BLOCKED_COPY}
          </p>
          <button type="button" onClick={retry} className="text-sm font-medium underline">
            Retry
          </button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">Protected by Cloudflare Turnstile.</p>
    </div>
  );
}
