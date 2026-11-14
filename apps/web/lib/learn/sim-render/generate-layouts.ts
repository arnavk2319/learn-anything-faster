// Build-time only: `pnpm learn:layout`. Runs ELK over every template sim and writes
// generated/layouts.json (positions and route points). Never imported by app code.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ELK from "elkjs/lib/elk.bundled.js";
import { elkInput, fromElk, type SimLayout } from "./layout";
import { compileTemplate, TEMPLATE_NAMES } from "../sim/templates";
import type { Sim } from "../schemas";

export function templateSims(): Sim[] {
  return TEMPLATE_NAMES.flatMap((name) => {
    const r = compileTemplate({ id: name, template: name });
    return r.ok ? [r.sim] : [];
  });
}

export async function buildLayouts(
  sims: Sim[] = templateSims(),
): Promise<Record<string, SimLayout>> {
  const elk = new ELK();
  const out: Record<string, SimLayout> = {};
  for (const sim of sims) out[sim.id] = fromElk(await elk.layout(elkInput(sim)));
  return out;
}

export const OUT = fileURLToPath(new URL("./generated/layouts.json", import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const layouts = await buildLayouts();
  writeFileSync(OUT, `${JSON.stringify(layouts, null, 2)}\n`);
}
