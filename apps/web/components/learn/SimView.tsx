// Presentational sim frame (DESIGN.md 14.5): canvas, legend, caption, controls, inspector.
// Plain SVG, no @xyflow. Used for the server-rendered poster (interactive=false) and by SimPlayer.
import type { KeyboardEvent, RefObject } from "react";
import { useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useShellSlots } from "@/lib/shell/context";
import type { Sim } from "@/lib/learn/schemas";
import { transcript, type Frame, type FrameToken } from "@/lib/learn/sim/engine";
import {
  CARD_H,
  PILL_H,
  pointAlong,
  roundedPath,
  SLOT_GAP,
  SLOT_W,
  type SimLayout,
} from "@/lib/learn/sim-render/layout";
import {
  evictingKey,
  SPEEDS,
  stepIndex,
  tokenWidth,
  widgetItems,
  type Speed,
} from "@/lib/learn/sim-render/view";

type SimNode = Sim["nodes"][number];

export type SimViewProps = {
  title: string;
  sim: Sim;
  layout: SimLayout;
  scenarioId: string;
  frame: Frame;
  pulsed: string[];
  steps: number[];
  playing: boolean;
  speed: Speed;
  reduced: boolean;
  interactive: boolean;
  selected: string | null;
  onPlayPause?: () => void;
  onRestart?: () => void;
  onStep?: (dir: 1 | -1) => void;
  onSpeed?: (s: Speed) => void;
  onSeek?: (atMs: number) => void;
  onScenario?: (id: string) => void;
  onSelect?: (id: string | null) => void;
  nodeRefs?: RefObject<Record<string, SVGGElement | null>>;
  closeRef?: RefObject<HTMLButtonElement | null>;
  rootRef?: RefObject<HTMLDivElement | null>;
};

const TOKENS = {
  request: {
    label: "Request",
    shape: "filled",
    box: "fill-sim-request stroke-sim-request",
    text: "fill-primary-foreground",
  },
  response: {
    label: "Response",
    shape: "outlined",
    box: "fill-card stroke-sim-response",
    text: "fill-sim-response",
  },
  replicate: {
    label: "Replicate",
    shape: "dashed",
    box: "fill-card stroke-sim-replicate [stroke-dasharray:4_3]",
    text: "fill-foreground",
  },
  error: {
    label: "Error",
    shape: "filled with !",
    box: "fill-sim-error stroke-sim-error",
    text: "fill-primary-foreground",
  },
} as const;
type TokenKind = keyof typeof TOKENS;
const kindOf = (c: string | undefined): TokenKind =>
  c && Object.hasOwn(TOKENS, c) ? (c as TokenKind) : "request";
const EDGE_HOT: Record<TokenKind, string> = {
  request: "stroke-sim-request",
  response: "stroke-sim-response",
  replicate: "stroke-sim-replicate",
  error: "stroke-sim-error",
};

const btn =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium text-foreground hover:bg-lane disabled:opacity-50 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring";
// Compact icon control: small visible box, hit area padded out to 44px with a pseudo-element.
const ibtn =
  "relative inline-flex size-7 items-center justify-center rounded-md border border-input bg-card text-xs font-semibold tabular-nums text-foreground hover:bg-lane disabled:opacity-50 before:absolute before:-inset-2 before:content-[''] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring";

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
      <path d={d} />
    </svg>
  );
}
const ICON = {
  play: "M4 2.5v11l9-5.5z",
  pause: "M3.5 2h3.5v12H3.5zM9 2h3.5v12H9z",
  restart: "M8 2a6 6 0 1 0 6 6h-2a4 4 0 1 1-1.2-2.8L9 7h5V2l-1.8 1.8A6 6 0 0 0 8 2z",
  back: "M11 2v12L3 8zM12.5 2H14v12h-1.5z",
  step: "M5 2v12l8-6zM2 2h1.5v12H2z",
};

function Widget({
  sim,
  scenarioId,
  t,
  node,
  frame,
  h,
}: {
  sim: Sim;
  scenarioId: string;
  t: number;
  node: SimNode;
  frame: Frame;
  h: number;
}) {
  const st = frame.state[node.id];
  if (!st || !node.state) return null;
  const y = h - 52;
  if (st.type === "lru" && node.state.type === "lru") {
    const initKeys = node.state.init;
    const victim = evictingKey(sim, scenarioId, t, node.id, st.init, st.capacity);
    return (
      <g aria-hidden="true" className="pointer-events-none">
        {st.init.map((k, i) => {
          const fresh = !initKeys.includes(k);
          const touched = i === 0 && !fresh && k !== initKeys[0];
          const cls = touched
            ? "fill-highlight stroke-primary"
            : fresh
              ? "fill-known stroke-known-ring"
              : k === victim
                ? "fill-card stroke-destructive [stroke-dasharray:4_3]"
                : "fill-card stroke-border";
          return (
            <g
              key={k}
              style={{ transform: `translate(${12 + i * (SLOT_W + SLOT_GAP)}px, ${y}px)` }}
              className="transition-transform [transition-duration:var(--sim-state-dur)]"
            >
              <rect
                width={SLOT_W}
                height={40}
                strokeWidth={1.5}
                className={`[rx:var(--radius)] ${cls}`}
              />
              <text
                x={SLOT_W / 2}
                y={20}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-foreground font-sans text-sm font-semibold"
              >
                {k}
              </text>
            </g>
          );
        })}
      </g>
    );
  }
  const items = widgetItems(st);
  const shown = items.slice(0, 3);
  return (
    <g aria-hidden="true" className="pointer-events-none">
      {shown.map((k, i) => (
        <g key={`${k}-${i}`} transform={`translate(${12 + i * 60} ${y + 4})`}>
          <rect
            width={54}
            height={32}
            strokeWidth={1.5}
            className="fill-card stroke-border [rx:var(--radius)]"
          />
          <text
            x={27}
            y={16}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground font-sans text-xs font-semibold"
          >
            {k}
          </text>
        </g>
      ))}
      {items.length > shown.length && (
        <text
          x={12 + shown.length * 60}
          y={y + 20}
          dominantBaseline="central"
          className="fill-muted-foreground font-sans text-xs"
        >
          +{items.length - shown.length}
        </text>
      )}
    </g>
  );
}

function Token({ tk, layout }: { tk: FrameToken; layout: SimLayout }) {
  const kind = kindOf(tk.color);
  const route = tk.edge ? layout.edges[tk.edge] : undefined;
  const box = tk.node ? layout.nodes[tk.node] : undefined;
  const p = route
    ? pointAlong(route, tk.progress ?? 0)
    : box
      ? { x: box.x + box.w / 2, y: box.y - 4 }
      : null;
  if (!p) return null;
  const label = `${kind === "error" ? "! " : ""}${tk.label}`;
  const w = tokenWidth(tk.label, tk.color);
  const pr = tk.progress ?? 0.5;
  const opacity = Math.min(1, pr * 10, (1 - pr) * 10 + 0.0001);
  const spec = TOKENS[kind];
  return (
    <g
      data-token={tk.label}
      style={{ transform: `translate(${p.x}px, ${p.y}px)`, opacity: Math.max(0, opacity) }}
      aria-hidden="true"
    >
      <rect
        x={-w / 2}
        y={-12}
        width={w}
        height={24}
        strokeWidth={1.5}
        className={`[rx:var(--radius-pill)] ${spec.box}`}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        className={`${spec.text} font-sans text-xs font-semibold`}
      >
        {label}
      </text>
    </g>
  );
}

function NodeShape({
  n,
  box,
  p,
}: {
  n: SimNode;
  box: { w: number; h: number };
  p: { selected: boolean; pulsed: boolean };
}) {
  const stroke = p.selected
    ? "stroke-primary"
    : p.pulsed
      ? "stroke-route"
      : "stroke-[var(--bark)] group-hover:stroke-primary";
  const fill = p.selected ? "fill-highlight" : "fill-card";
  const sw = p.pulsed ? 3 : 1.5;
  const cls = `${fill} ${stroke}`;
  if (n.kind === "decision")
    return (
      <polygon
        points={`${box.w / 2},1 ${box.w - 1},${box.h / 2} ${box.w / 2},${box.h - 1} 1,${box.h / 2}`}
        strokeWidth={sw}
        className={cls}
      />
    );
  const r = n.state ? "[rx:var(--radius-panel)]" : "[rx:var(--radius-pill)]";
  return (
    <rect
      x={0.75}
      y={0.75}
      width={box.w - 1.5}
      height={box.h - 1.5}
      strokeWidth={sw}
      className={`${r} ${cls}`}
    />
  );
}

const FOCUSABLE =
  "button:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex='-1'])";

// On a phone the inspector is a modal bottom sheet: keep Tab inside it. On desktop it is an
// inline panel, so Tab flows on normally.
function trapSheetTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab" || !window.matchMedia("(max-width: 767px)").matches) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const at = document.activeElement;
  if (e.shiftKey && at === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && at === last) {
    e.preventDefault();
    first.focus();
  } else if (!e.currentTarget.contains(at)) {
    e.preventDefault();
    first.focus();
  }
}

const wideSubscribe = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 1024px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useIsWide = () =>
  useSyncExternalStore(
    wideSubscribe,
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );

export function SimView(p: SimViewProps) {
  const { sim, layout, frame, scenarioId } = p;
  // Inside the Learn shell at >= 1024px the inspector lives in the right rail (T-080); everywhere else it stays
  // inline (side panel on tablet, bottom sheet on phone) exactly as in T-043.
  const shell = useShellSlots();
  const wide = useIsWide();
  const railSlot = wide ? (shell?.inspector ?? null) : null;
  const uid = useId();
  const marker = `${uid}-chev`;
  const hotEdges = new Map<string, TokenKind>();
  for (const tk of frame.tokens) if (tk.edge) hotEdges.set(tk.edge, kindOf(tk.color));
  for (const e of frame.highlights.edges) if (!hotEdges.has(e)) hotEdges.set(e, "request");
  const idx = stepIndex(p.steps, frame.t);
  const stepList = transcript(sim, scenarioId);
  const sel = p.selected ? sim.nodes.find((n) => n.id === p.selected) : undefined;
  const scenarios = sim.scenarios;
  const w = layout.width;
  const h = layout.height;

  const select = (id: string | null) => {
    if (id) shell?.expandRight();
    p.onSelect?.(id);
  };

  const onCanvasKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!p.interactive) return;
    if (e.key === " ") {
      e.preventDefault();
      p.onPlayPause?.();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      p.onStep?.(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      p.onStep?.(-1);
    } else if (e.key === "r" || e.key === "R") p.onRestart?.();
  };

  const Panel = railSlot ? "section" : "aside"; // an aside nested in the rail's aside would nest landmarks
  const inspector = sel ? (
    <>
      <div
        aria-hidden="true"
        onClick={() => p.onSelect?.(null)}
        className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
      />
      <Panel
        aria-label={`${sel.label} details`}
        onKeyDown={trapSheetTab}
        className="mt-4 rounded-md border border-border bg-lane p-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-50 max-md:mt-0 max-md:max-h-[90vh] max-md:min-h-[40vh] max-md:overflow-auto max-md:rounded-t-lg max-md:rounded-b-none max-md:bg-card motion-safe:max-md:animate-[sim-sheet-in_var(--dur-slow)_var(--ease-trail)] lg:mt-0"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 rounded-pill bg-border md:hidden"
        />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{sel.kind}</p>
            <h3 className="font-display text-lg font-semibold break-words text-foreground">
              {sel.label}
            </h3>
          </div>
          <button type="button" ref={p.closeRef} onClick={() => p.onSelect?.(null)} className={btn}>
            Close
          </button>
        </div>
        <p className="mt-2 text-base text-foreground">{sel.inspect}</p>
        <StateList node={sel} frame={frame} />
      </Panel>
    </>
  ) : null;

  return (
    <div
      ref={p.rootRef}
      data-sim={sim.id}
      onKeyDown={(e) => {
        if (e.key === "Escape" && p.selected) p.onSelect?.(null);
      }}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className={shell ? undefined : "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-4"}>
        <div>
          {/* The scroll container is the focusable canvas: Space, arrows and R act here. */}
          <div
            tabIndex={0}
            role="group"
            aria-label={`${p.title} diagram. Space plays or pauses, left and right arrows step, R restarts.`}
            onKeyDown={onCanvasKey}
            className="overflow-x-auto rounded-md bg-canvas focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="block w-full min-w-[680px]"
              style={{ aspectRatio: `${w} / ${h}` }}
            >
              <title>{p.title}</title>
              <defs>
                <marker
                  id={marker}
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                >
                  <path
                    d="M1 1 L7 4 L1 7"
                    fill="none"
                    strokeWidth={1.5}
                    className="stroke-edge-unmet"
                  />
                </marker>
              </defs>
              <g aria-hidden="true" fill="none" strokeWidth={1.5} className="stroke-contour">
                <path
                  d={`M0 ${h * 0.22} C ${w * 0.3} ${h * 0.02} ${w * 0.62} ${h * 0.42} ${w} ${h * 0.16}`}
                />
                <path
                  d={`M0 ${h * 0.5} C ${w * 0.25} ${h * 0.3} ${w * 0.55} ${h * 0.7} ${w} ${h * 0.46}`}
                />
                <path
                  d={`M0 ${h * 0.86} C ${w * 0.3} ${h * 0.7} ${w * 0.65} ${h * 1.02} ${w} ${h * 0.8}`}
                />
              </g>
              {sim.edges.map((e) => {
                const route = layout.edges[e.id];
                if (!route) return null;
                const d = roundedPath(route);
                const mid = pointAlong(route, 0.5);
                const hot = hotEdges.get(e.id);
                return (
                  <g key={e.id} data-edge={e.id}>
                    <path
                      d={d}
                      fill="none"
                      strokeWidth={1.5}
                      markerEnd={`url(#${marker})`}
                      className="stroke-edge-unmet [stroke-dasharray:5_4]"
                    />
                    {hot && <path d={d} fill="none" strokeWidth={3.5} className={EDGE_HOT[hot]} />}
                    {e.label && (
                      <text
                        x={mid.x}
                        y={mid.y - 8}
                        textAnchor="middle"
                        className="fill-muted-foreground stroke-canvas font-sans text-xs [paint-order:stroke]"
                        strokeWidth={4}
                      >
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {sim.nodes.map((n) => {
                const b = layout.nodes[n.id];
                if (!b) return null;
                const isSel = p.selected === n.id;
                const verdict = frame.decisions[n.id];
                const props = p.interactive
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      "aria-pressed": isSel,
                      "aria-label": verdict ? `${n.label} ${verdict}` : n.label, // name must contain the visible verdict text
                      onClick: () => select(isSel ? null : n.id),
                      onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          select(isSel ? null : n.id);
                        }
                      },
                      ref: (el: SVGGElement | null) => {
                        if (p.nodeRefs?.current) p.nodeRefs.current[n.id] = el;
                      },
                      className: "group cursor-pointer outline-none",
                    }
                  : { className: "group" };
                return (
                  <g key={n.id} transform={`translate(${b.x} ${b.y})`}>
                    {/* The widget sits outside the button group so the button's name matches its visible text. */}
                    <g data-node={n.id} {...props}>
                      <rect
                        x={-3}
                        y={-3}
                        width={b.w + 6}
                        height={b.h + 6}
                        fill="none"
                        strokeWidth={3}
                        className="stroke-ring opacity-0 [rx:var(--radius-panel)] group-focus-visible:opacity-100"
                      />
                      <NodeShape
                        n={n}
                        box={b}
                        p={{
                          selected: isSel,
                          pulsed: p.pulsed.includes(n.id) || frame.highlights.nodes.includes(n.id),
                        }}
                      />
                      {n.kind === "decision" ? (
                        <>
                          <text
                            x={b.w / 2}
                            y={b.h / 2 - (verdict ? 6 : 0)}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-foreground font-sans text-xs font-medium"
                          >
                            {n.label}
                          </text>
                          {verdict && (
                            <text
                              x={b.w / 2}
                              y={b.h / 2 + 10}
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-muted-foreground font-sans text-xs font-semibold"
                            >
                              {verdict}
                            </text>
                          )}
                        </>
                      ) : (
                        <>
                          <circle
                            cx={20}
                            cy={n.state ? 22 : PILL_H / 2}
                            r={5.5}
                            strokeWidth={3}
                            className="fill-card stroke-known-ring"
                            aria-hidden="true"
                          />
                          <text
                            x={36}
                            y={n.state ? 22 : PILL_H / 2}
                            dominantBaseline="central"
                            className="fill-foreground font-sans text-sm font-medium"
                          >
                            {n.label}
                          </text>
                        </>
                      )}
                    </g>
                    {n.kind !== "decision" && (
                      <Widget
                        sim={sim}
                        scenarioId={scenarioId}
                        t={frame.t}
                        node={n}
                        frame={frame}
                        h={n.state ? CARD_H : b.h}
                      />
                    )}
                  </g>
                );
              })}
              {frame.tokens.map((tk, i) => (
                <Token key={`${tk.label}-${tk.edge ?? tk.node}-${i}`} tk={tk} layout={layout} />
              ))}
            </svg>
          </div>
          <p className="mt-1 text-xs text-muted-foreground md:hidden">
            Swipe sideways to pan the diagram
          </p>

          <ul
            aria-label="Token legend"
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
          >
            {(Object.keys(TOKENS) as TokenKind[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <svg aria-hidden="true" width="28" height="14" viewBox="0 0 28 14">
                  <rect
                    x="1"
                    y="1"
                    width="26"
                    height="12"
                    strokeWidth={1.5}
                    className={`[rx:var(--radius-pill)] ${TOKENS[k].box}`}
                  />
                </svg>
                {TOKENS[k].label}, {TOKENS[k].shape}
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-md bg-lane px-4 py-3">
            <p
              aria-live="polite"
              aria-atomic="true"
              data-testid="sim-caption"
              className="text-xs text-muted-foreground tabular-nums"
            >
              Step {idx} of {p.steps.length}
            </p>
            <ol aria-label="Steps" data-testid="sim-steps" className="mt-1 space-y-1">
              {stepList.map((st) => {
                const active = st.n === idx;
                return (
                  <li key={st.n}>
                    <button
                      type="button"
                      disabled={!p.interactive}
                      aria-current={active ? "step" : undefined}
                      onClick={() => p.onSeek?.(st.atMs)}
                      className={`flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-sm focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default ${active ? "bg-highlight text-highlight-foreground" : "text-foreground enabled:hover:bg-card"}`}
                    >
                      <span className="tabular-nums">{st.n}.</span>
                      <span>{st.text}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {p.reduced && (
              <p className="mt-1 text-xs text-muted-foreground">
                Reduced motion is on: step through, or press Play.
              </p>
            )}
          </div>

          <div
            className="mt-3 flex flex-wrap items-center gap-3"
            role="toolbar"
            aria-label="Simulation controls"
          >
            <button
              type="button"
              disabled={!p.interactive}
              onClick={p.onPlayPause}
              className={`${ibtn} border-primary bg-primary text-primary-foreground hover:bg-primary-hover`}
              aria-label={p.playing ? "Pause" : "Play"}
              title={p.playing ? "Pause" : "Play"}
            >
              <Icon d={p.playing ? ICON.pause : ICON.play} />
            </button>
            <button
              type="button"
              disabled={!p.interactive}
              onClick={p.onRestart}
              className={ibtn}
              aria-label="Restart"
              title="Restart"
            >
              <Icon d={ICON.restart} />
            </button>
            <button
              type="button"
              disabled={!p.interactive}
              onClick={() => p.onStep?.(-1)}
              className={ibtn}
              aria-label="Step back"
              title="Step back"
            >
              <Icon d={ICON.back} />
            </button>
            <button
              type="button"
              disabled={!p.interactive}
              onClick={() => p.onStep?.(1)}
              className={ibtn}
              aria-label="Step forward"
              title="Step forward"
            >
              <Icon d={ICON.step} />
            </button>
            <div role="group" aria-label="Speed" className="flex gap-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!p.interactive}
                  aria-pressed={p.speed === s}
                  aria-label={`Speed ${s}x`}
                  title={`Speed ${s}x`}
                  onClick={() => p.onSpeed?.(s)}
                  className={`${ibtn} ${p.speed === s ? "border-primary bg-highlight text-highlight-foreground" : ""}`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="max-w-full min-w-0 max-md:w-full md:ml-auto">
              <label htmlFor={`${uid}-sc`} className="sr-only">
                Scenario
              </label>
              <select
                id={`${uid}-sc`}
                disabled={!p.interactive || scenarios.length < 2}
                value={scenarioId}
                onChange={(e) => p.onScenario?.(e.target.value)}
                className="h-7 max-w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring max-md:w-full"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {inspector && !railSlot ? inspector : null}
      </div>

      {inspector && railSlot ? createPortal(inspector, railSlot) : null}

      <details className="mt-3 border-t border-border pt-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ring">
          Read this as text
        </summary>
        {sim.scenarios.map((sc) => (
          <div key={sc.id} className="mt-3">
            <h4 className="text-base font-semibold text-foreground">{sc.title}</h4>
            <ol className="mt-1 list-decimal pl-6 text-base text-foreground">
              {transcript(sim, sc).map((st) => (
                <li key={st.n}>{st.text}</li>
              ))}
            </ol>
          </div>
        ))}
      </details>
    </div>
  );
}

function StateList({ node, frame }: { node: SimNode; frame: Frame }) {
  const st = frame.state[node.id];
  if (!st) return null;
  const items = widgetItems(st);
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      <dt className="text-muted-foreground">State</dt>
      <dd>{st.type}</dd>
      {st.type === "lru" && (
        <>
          <dt className="text-muted-foreground">Capacity</dt>
          <dd>{st.capacity}</dd>
          <dt className="text-muted-foreground">Order</dt>
          <dd>{items.join(", ") || "empty"} (most recent to least recent)</dd>
          <dt className="text-muted-foreground">Next to evict</dt>
          <dd>{items.length >= st.capacity ? items[items.length - 1] : "none, not full"}</dd>
        </>
      )}
      {st.type !== "lru" && (
        <>
          <dt className="text-muted-foreground">Contents</dt>
          <dd>{items.join(", ") || "empty"}</dd>
        </>
      )}
    </dl>
  );
}
