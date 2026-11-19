// Build-time only: `pnpm learn:layout`. Runs ELK over every template sim and writes
// generated/layouts.json (positions and route points). Never imported by app code.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ELK from "elkjs/lib/elk.bundled.js";
import { elkInput, fromElk, type LayoutMode, type SimLayout } from "./layout";
import { compileTemplate, TEMPLATE_NAMES } from "../sim/templates";
import type { Sim } from "../schemas";

export function templateSims(): Sim[] {
  return TEMPLATE_NAMES.flatMap((name) => {
    const r = compileTemplate({ id: name, template: name });
    return r.ok ? [r.sim] : [];
  });
}

/** Layouts keyed by sim id, sorted by id so the written JSON is stable. */
export async function buildLayouts(
  sims: Sim[] = templateSims(),
  mode: LayoutMode = "wide",
): Promise<Record<string, SimLayout>> {
  const elk = new ELK();
  const out: Record<string, SimLayout> = {};
  for (const sim of [...sims].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
    out[sim.id] = fromElk(await elk.layout(elkInput(sim, mode)));
  return out;
}

export const buildNarrowLayouts = (sims: Sim[] = templateSims()) => buildLayouts(sims, "narrow");

export const serialize = (l: Record<string, SimLayout>) => `${JSON.stringify(l, null, 2)}\n`;

export const OUT = fileURLToPath(new URL("./generated/layouts.json", import.meta.url));
export const OUT_NARROW = fileURLToPath(
  new URL("./generated/layouts-narrow.json", import.meta.url),
);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(OUT, serialize(await buildLayouts()));
  writeFileSync(OUT_NARROW, serialize(await buildNarrowLayouts()));
}
