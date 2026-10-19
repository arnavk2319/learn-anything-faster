import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const REPO = resolve(import.meta.dirname, "..", "..");

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(
  cmd: string,
  args: string[],
  opts: { input?: string; env?: Record<string, string>; cwd?: string } = {},
): Run {
  const r = spawnSync(cmd, args, {
    input: opts.input ?? "",
    encoding: "utf8",
    cwd: opts.cwd ?? REPO,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: REPO,
      LAF_ROOT: REPO,
      LAF_ALLOW_PROTECTED: "",
      ...opts.env,
    },
  });
  return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

export const hook = (name: string, payload: unknown, env: Record<string, string> = {}): Run =>
  run("bash", [join(REPO, ".claude/hooks", name)], { input: JSON.stringify(payload), env });

export const edit = (file_path: string) => ({ tool_name: "Edit", tool_input: { file_path } });
export const bash = (command: string) => ({ tool_name: "Bash", tool_input: { command } });

/** A throwaway project root with the real budgets.json and an empty logs/ + docs/tickets/. */
export function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "laf-"));
  mkdirSync(join(dir, ".claude"), { recursive: true });
  cpSync(join(REPO, ".claude/budgets.json"), join(dir, ".claude/budgets.json"));
  mkdirSync(join(dir, "logs/usage"), { recursive: true });
  mkdirSync(join(dir, "logs/decisions"), { recursive: true });
  mkdirSync(join(dir, "docs/tickets"), { recursive: true });
  return dir;
}

export function writeUsage(
  dir: string,
  agent: string,
  rows: { ts: string; ticket: string; cost_usd: number; stage?: string }[],
): void {
  const lines = rows.map((r) =>
    JSON.stringify({
      agent,
      stage: "build",
      parent: "orchestrator",
      session: "s",
      model: "sonnet",
      ...r,
    }),
  );
  writeFileSync(join(dir, "logs/usage", `${agent}.jsonl`), lines.join("\n") + "\n");
}
