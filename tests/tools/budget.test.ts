import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classify, loadBudgets, median, weekKey } from "../../scripts/lib/budget.ts";
import { REPO, run, tempRoot, writeUsage } from "./helpers.ts";

const NOW = "2026-10-21T12:00:00Z";
const guard = (root: string, ticket: string) =>
  run("node", [join(REPO, "scripts/guard-budget.ts"), "--ticket", ticket, "--now", NOW], {
    env: { LAF_ROOT: root },
  });

describe("budget math", () => {
  const b = loadBudgets(REPO);
  it("classifies at 70% and 100%", () => {
    expect(classify(0.69, 1, b)).toBe("ok");
    expect(classify(0.7, 1, b)).toBe("warn");
    expect(classify(0.99, 1, b)).toBe("warn");
    expect(classify(1, 1, b)).toBe("stop");
    expect(classify(5, 1, b)).toBe("stop");
  });
  it("matches the spec defaults", () => {
    expect(b.ticket_usd).toEqual({ S: 1.5, M: 4, L: 8 });
    expect([b.run.usd, b.run.turns, b.curator_run_usd, b.day_usd, b.week_usd]).toEqual([
      2,
      40,
      10,
      25,
      75, // day/week raised for the fast-lane window (ADR-0008); spec default is 15/60
    ]);
  });
  it("median and ISO week", () => {
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 3])).toBe(2);
    expect(weekKey(new Date("2026-10-21T00:00:00Z"))).toBe("2026-W43");
  });
});

describe("guard-budget on a dummy ticket", () => {
  const ticket = (root: string, size: string) =>
    writeFileSync(
      join(root, "docs/tickets/T-999.md"),
      `# T-999 dummy\nstatus: approved\nsize: ${size}\n`,
    );

  it("is silent under 70%", () => {
    const root = tempRoot();
    ticket(root, "S"); // cap $1.50
    writeUsage(root, "implementer", [
      { ts: "2026-10-21T10:00:00Z", ticket: "T-999", cost_usd: 0.5 },
    ]);
    const r = guard(root, "T-999");
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("warns at 70% and continues", () => {
    const root = tempRoot();
    ticket(root, "S");
    writeUsage(root, "implementer", [
      { ts: "2026-10-21T10:00:00Z", ticket: "T-999", cost_usd: 1.1 },
    ]); // 73%
    const r = guard(root, "T-999");
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("BUDGET WARN");
    expect(r.stdout).toContain("ticket T-999");
  });

  it("hard stops at 100% with exit 2", () => {
    const root = tempRoot();
    ticket(root, "S");
    writeUsage(root, "implementer", [
      { ts: "2026-10-21T10:00:00Z", ticket: "T-999", cost_usd: 1.5 },
    ]);
    const r = guard(root, "T-999");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("BUDGET STOP");
  });

  it("stops on the daily cap across tickets", () => {
    const root = tempRoot();
    writeUsage(root, "implementer", [
      { ts: "2026-10-21T08:00:00Z", ticket: "T-001", cost_usd: 13 },
      { ts: "2026-10-21T09:00:00Z", ticket: "T-002", cost_usd: 12 },
    ]);
    const r = guard(root, "T-003");
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/day: \$25\.00 of \$25\.00/);
  });

  it("ignores spend from other days for the daily cap", () => {
    const root = tempRoot();
    writeUsage(root, "implementer", [
      { ts: "2026-10-20T08:00:00Z", ticket: "T-001", cost_usd: 14 },
    ]);
    expect(guard(root, "T-003").code).toBe(0);
  });

  it("reads the ticket id from a Task hook payload", () => {
    const root = tempRoot();
    ticket(root, "S");
    writeUsage(root, "implementer", [{ ts: "2026-10-21T10:00:00Z", ticket: "T-999", cost_usd: 2 }]);
    const payload = {
      tool_name: "Agent",
      tool_input: { prompt: "Implement docs/tickets/T-999.md" },
    };
    const r = run("node", [join(REPO, "scripts/guard-budget.ts"), "--now", NOW], {
      input: JSON.stringify(payload),
      env: { LAF_ROOT: root },
    });
    expect(r.code).toBe(2);
  });
});
