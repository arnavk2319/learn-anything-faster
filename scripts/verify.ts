// pnpm verify: typecheck, lint, unit, integration, tools, content:validate. Prints failures only.
import { spawnSync } from "node:child_process";

const steps: [string, string[]][] = [
  ["typecheck", ["typecheck"]],
  ["lint", ["lint"]],
  ["unit", ["test"]],
  ["integration", ["test:integration"]],
  ["tools", ["test:tools"]],
  ["security", ["test:security"]],
  ["data", ["test:data"]],
  ["content:validate", ["content:validate"]],
];

const MAX_LINES = 50;
let failed = 0;

for (const [name, args] of steps) {
  const r = spawnSync("pnpm", ["--silent", ...args], { encoding: "utf8" });
  if (r.status === 0) continue;
  failed++;
  const out = `${r.stdout}\n${r.stderr}`.trim().split("\n");
  console.log(`\n✗ ${name}`);
  console.log(out.slice(-MAX_LINES).join("\n"));
}

if (failed > 0) {
  console.log(`\nverify: ${failed}/${steps.length} steps failed`);
  process.exit(1);
}
console.log(`verify: ok (${steps.length} steps)`);
