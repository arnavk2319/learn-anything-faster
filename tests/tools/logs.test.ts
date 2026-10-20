import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findSensitive } from "../../scripts/lib/safety.ts";
import { REPO, run, tempRoot } from "./helpers.ts";

const logDecision = (root: string, extra: string[]) =>
  run(
    "node",
    [
      join(REPO, "scripts/log-decision.ts"),
      "--agent",
      "implementer",
      "--ticket",
      "T-007",
      "--stage",
      "build",
      ...extra,
    ],
    { env: { LAF_ROOT: root } },
  );

describe("log-decision", () => {
  it("appends a JSON line with the parent recorded", () => {
    const root = tempRoot();
    const r = logDecision(root, [
      "--decision",
      "Cache per role pair",
      "--why",
      "Content changes only on deploy",
      "--alternatives",
      "no cache|db cache",
    ]);
    expect(r.code, r.stderr).toBe(0);
    const e = JSON.parse(
      readFileSync(join(root, "logs/decisions/implementer.jsonl"), "utf8").trim(),
    );
    expect(e).toMatchObject({
      agent: "implementer",
      parent: "orchestrator",
      ticket: "T-007",
      alternatives: ["no cache", "db cache"],
    });
  });

  it.each([
    ["an email", "ping arnav@example.com"],
    ["an API key", "used sk-ant-api03-abcdefghijklmnop1234"],
    ["a github token", "ghp_abcdefghijklmnopqrstuvwxyz0123"],
    ["a DB url with password", "postgres://user:hunter2@host/db"],
  ])("refuses %s", (_n, why) => {
    const root = tempRoot();
    const r = logDecision(root, ["--decision", "x", "--why", why]);
    expect(r.code).toBe(1);
    expect(existsSync(join(root, "logs/decisions/implementer.jsonl"))).toBe(false);
  });

  it("requires decision and why", () => {
    expect(logDecision(tempRoot(), ["--decision", "only"]).code).toBe(1);
  });
});

describe("log-usage", () => {
  const msg = (id: string, usage: object, content: object[] = []) =>
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-10-21T10:00:00Z",
      message: { id, model: "claude-sonnet-5-5", usage, content },
    });

  it("logs cost from a transcript, dedups repeated message ids and logs only deltas", () => {
    const root = tempRoot();
    writeFileSync(join(root, "docs/tickets/T-999.md"), "# T-999\nsize: M\nspent_usd: 0.00\n");
    const t = join(root, "transcript.jsonl");
    const u = {
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 10000,
      cache_creation_input_tokens: 2000,
    };
    writeFileSync(
      t,
      [
        msg("m1", u, [{ type: "tool_use" }]),
        msg("m1", u, [{ type: "tool_use" }]),
        msg("m2", u),
      ].join("\n") + "\n",
    );
    const payload = JSON.stringify({
      hook_event_name: "SubagentStop",
      agent_type: "implementer",
      session_id: "s1",
      agent_transcript_path: t,
    });
    const env = { LAF_ROOT: root, LAF_TICKET: "T-999" };

    expect(run("node", [join(REPO, "scripts/log-usage.ts")], { input: payload, env }).code).toBe(0);
    const rows = readFileSync(join(root, "logs/usage/implementer.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(rows).toHaveLength(1);
    // 2 distinct messages: (1000*3 + 500*15 + 10000*0.3 + 2000*3.75) / 1e6 * 2
    expect(rows[0].cost_usd).toBeCloseTo(((3000 + 7500 + 3000 + 7500) * 2) / 1e6, 6);
    expect(rows[0]).toMatchObject({
      agent: "implementer",
      parent: "orchestrator",
      ticket: "T-999",
      stage: "build",
      turns: 2,
      tool_calls: 2,
    });
    expect(readFileSync(join(root, "docs/tickets/T-999.md"), "utf8")).toMatch(/spent_usd: 0\.04/);

    // second call with no new messages writes nothing
    run("node", [join(REPO, "scripts/log-usage.ts")], { input: payload, env });
    expect(
      readFileSync(join(root, "logs/usage/implementer.jsonl"), "utf8").trim().split("\n"),
    ).toHaveLength(1);
  });
});

describe("committed logs", () => {
  it("contain no secrets or emails", () => {
    for (const sub of ["decisions", "usage"]) {
      const dir = join(REPO, "logs", sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter((x) => x.endsWith(".jsonl"))) {
        expect(findSensitive(readFileSync(join(dir, f), "utf8")), `${sub}/${f}`).toBeNull();
      }
    }
  });
});

describe("log-usage ticket attribution", () => {
  const usage = {
    input_tokens: 100,
    output_tokens: 50,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };
  const userMsg = (text: string) =>
    JSON.stringify({
      type: "user",
      timestamp: "2026-10-21T10:00:00Z",
      message: { role: "user", content: text },
    });
  const asstMsg = (id: string) =>
    JSON.stringify({
      type: "assistant",
      timestamp: "2026-10-21T10:00:01Z",
      message: { id, model: "claude-sonnet-5-5", usage, content: [] },
    });

  const runLogUsage = (agentType: string | null, brief: string) => {
    const root = tempRoot();
    const t = join(root, "transcript.jsonl");
    writeFileSync(t, [userMsg(brief), asstMsg("m1")].join("\n") + "\n");
    const payload =
      agentType === null
        ? { hook_event_name: "Stop", session_id: "s", transcript_path: t }
        : {
            hook_event_name: "SubagentStop",
            agent_type: agentType,
            session_id: "s",
            agent_transcript_path: t,
          };
    const r = run("node", [join(REPO, "scripts/log-usage.ts")], {
      input: JSON.stringify(payload),
      env: { LAF_ROOT: root, LAF_TICKET: "" },
    });
    expect(r.code, r.stderr).toBe(0);
    const f = join(root, "logs/usage", `${agentType ?? "orchestrator"}.jsonl`);
    return JSON.parse(readFileSync(f, "utf8").trim());
  };

  it("attributes a subagent run to the ticket named in its brief", () => {
    expect(runLogUsage("implementer", "Implement ticket T-777 in the worktree").ticket).toBe(
      "T-777",
    );
  });

  it("uses the first ticket id when a brief mentions several", () => {
    expect(runLogUsage("reviewer", "Review T-004; compare with T-006").ticket).toBe("T-004");
  });

  it("falls back to none when the brief names no ticket", () => {
    expect(runLogUsage("planner", "Expand the backlog").ticket).toBe("none");
  });

  it("never attributes the orchestrator session to a ticket, even if the text mentions one", () => {
    expect(runLogUsage(null, "Run /build T-777 now").ticket).toBe("none");
  });

  it("still honours an explicit --ticket for the orchestrator", () => {
    const root = tempRoot();
    const t = join(root, "transcript.jsonl");
    writeFileSync(t, asstMsg("m1") + "\n");
    const payload = JSON.stringify({
      hook_event_name: "Stop",
      session_id: "s",
      transcript_path: t,
    });
    run("node", [join(REPO, "scripts/log-usage.ts"), "--ticket", "T-555"], {
      input: payload,
      env: { LAF_ROOT: root },
    });
    const row = JSON.parse(
      readFileSync(join(root, "logs/usage/orchestrator.jsonl"), "utf8").trim(),
    );
    expect(row.ticket).toBe("T-555");
  });
});
