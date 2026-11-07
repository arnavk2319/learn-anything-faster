"use client";
// Decorative contour pattern behind the graph (DESIGN.md section 6). Follows the viewport by writing
// patternTransform straight to the DOM in requestAnimationFrame: no React re-render per frame.
import { useEffect, useRef } from "react";
import { useStoreApi } from "@xyflow/react";
import { CONTOUR_TILE } from "./contour-tile";

const OFFSETS = [-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => [i, j] as const));

export function ContourLayer() {
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

  const { width, height, paths } = CONTOUR_TILE;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-testid="contour-layer"
      className="pointer-events-none absolute inset-0 -z-10 size-full"
    >
      <defs>
        <pattern
          ref={pattern}
          id="contour-tile"
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
        >
          <g id="contour-rings" fill="none" stroke="var(--contour)" strokeWidth={1}>
            {paths.map((d) => (
              <path key={d} d={d} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {OFFSETS.filter(([i, j]) => i !== 0 || j !== 0).map(([i, j]) => (
            <use key={`${i}${j}`} href="#contour-rings" x={i * width} y={j * height} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#contour-tile)" />
    </svg>
  );
}
