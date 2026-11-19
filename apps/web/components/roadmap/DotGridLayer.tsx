"use client";
// Decorative dot grid behind the graph (ADR-0016 amendment 1, DESIGN.md section 15). Follows the viewport by
// writing patternTransform straight to the DOM in requestAnimationFrame: no React re-render per frame.
import { useEffect, useRef } from "react";
import { useStoreApi } from "@xyflow/react";

export const DOT_GAP = 22;
const DOT_R = 1.2;

export function DotGridLayer() {
  const pattern = useRef<SVGPatternElement>(null);
  const store = useStoreApi();

  useEffect(() => {
    let frame = 0;
    const apply = () => {
      frame = 0;
      const [x, y, zoom] = store.getState().transform;
      pattern.current?.setAttribute("patternTransform", `translate(${x} ${y}) scale(${zoom})`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    apply();
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.transform !== prev.transform) schedule();
    });
    return () => {
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [store]);

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-testid="dot-grid"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
    >
      <defs>
        <pattern
          ref={pattern}
          id="canvas-dot-grid"
          width={DOT_GAP}
          height={DOT_GAP}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={DOT_GAP / 2}
            cy={DOT_GAP / 2}
            r={DOT_R}
            style={{ fill: "color-mix(in srgb, var(--pine) 20%, transparent)" }}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#canvas-dot-grid)" />
    </svg>
  );
}
