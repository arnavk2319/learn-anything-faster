// One shared requestAnimationFrame loop for every sim on the page (ADR-0015 section 2).
// It runs only while at least one subscriber exists; players subscribe only while playing and visible.
export type Tick = (dtMs: number) => void;
export type TickerEnv = {
  raf: (cb: (now: number) => void) => number;
  caf: (id: number) => void;
};

export const MAX_DT_MS = 100; // a tab returning from hidden must not jump the animation

export function createTicker(env: TickerEnv) {
  const subs = new Set<Tick>();
  let id = 0;
  let last: number | null = null;
  const frame = (now: number) => {
    const dt = last === null ? 0 : Math.min(MAX_DT_MS, Math.max(0, now - last));
    last = now;
    for (const s of [...subs]) s(dt);
    id = subs.size ? env.raf(frame) : 0;
  };
  return {
    subscribe(cb: Tick): () => void {
      subs.add(cb);
      if (subs.size === 1 && !id) {
        last = null;
        id = env.raf(frame);
      }
      return () => {
        subs.delete(cb);
        if (!subs.size && id) {
          env.caf(id);
          id = 0;
        }
      };
    },
    size: () => subs.size,
  };
}

let shared: ReturnType<typeof createTicker> | null = null;
/** Browser singleton. Call only from effects. */
export function subscribeTicker(cb: Tick): () => void {
  shared ??= createTicker({
    raf: (f) => window.requestAnimationFrame(f),
    caf: (i) => window.cancelAnimationFrame(i),
  });
  return shared.subscribe(cb);
}
