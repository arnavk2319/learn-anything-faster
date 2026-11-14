import { describe, expect, it } from "vitest";
import { createTicker, MAX_DT_MS } from "./ticker";

function fakeEnv() {
  let next = 1;
  const q = new Map<number, (n: number) => void>();
  return {
    env: {
      raf: (cb: (n: number) => void) => (q.set(next, cb), next++),
      caf: (i: number) => void q.delete(i),
    },
    pending: () => q.size,
    flush(now: number) {
      const cbs = [...q.values()];
      q.clear();
      for (const c of cbs) c(now);
    },
  };
}

describe("shared ticker", () => {
  it("runs one loop for many subscribers and stops when none remain", () => {
    const f = fakeEnv();
    const t = createTicker(f.env);
    const a: number[] = [];
    const un1 = t.subscribe((d) => a.push(d));
    const un2 = t.subscribe(() => {});
    expect(f.pending()).toBe(1);
    f.flush(1000);
    f.flush(1016);
    expect(a).toEqual([0, 16]);
    un1();
    expect(f.pending()).toBe(1);
    un2();
    expect(f.pending()).toBe(0);
  });
  it("clamps a long gap such as a tab returning from hidden", () => {
    const f = fakeEnv();
    const t = createTicker(f.env);
    const a: number[] = [];
    t.subscribe((d) => a.push(d));
    f.flush(0);
    f.flush(60_000);
    expect(a[1]).toBe(MAX_DT_MS);
  });
});
