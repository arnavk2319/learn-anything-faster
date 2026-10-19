import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO } from "./helpers.ts";

const settings = JSON.parse(readFileSync(join(REPO, ".claude/settings.json"), "utf8"));
const deny: string[] = settings.permissions.deny;

describe("settings.json deny list", () => {
  it.each([
    "Read(./.env*)",
    "Edit(./.env*)",
    "Read(./node_modules/**)",
    "Read(./.next/**)",
    "Read(./pnpm-lock.yaml)",
    "Read(./logs/runs/**)",
    "Read(./test-results/**)",
    "Bash(git push --force*)",
    "Bash(rm -rf*)",
    "Bash(vercel --prod*)",
  ])("denies %s", (rule) => expect(deny).toContain(rule));

  it("denies any push to main", () => {
    expect(deny.some((r) => /^Bash\(git push.*main/.test(r))).toBe(true);
  });
});

describe("settings.json hooks", () => {
  const all = JSON.stringify(settings.hooks);
  it.each([
    "guard-paths.sh",
    "guard-bash.sh",
    "guard-budget.sh",
    "post-edit.sh",
    "trace.sh",
    "log-usage.sh",
    "verify.sh",
  ])("wires %s and it exists + is executable", (h) => {
    expect(all).toContain(h);
    const p = join(REPO, ".claude/hooks", h);
    expect(existsSync(p)).toBe(true);
    expect(statSync(p).mode & 0o111).not.toBe(0);
  });
});

describe("subagent roster", () => {
  const front = (f: string) => {
    const m = /^---\n([\s\S]*?)\n---/.exec(readFileSync(join(REPO, ".claude/agents", f), "utf8"));
    return Object.fromEntries(
      (m?.[1] ?? "")
        .split("\n")
        .map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]),
    );
  };
  const agents = Object.fromEntries(
    readdirSync(join(REPO, ".claude/agents")).map((f) => [f.replace(".md", ""), front(f)]),
  );

  it("has exactly the 7 spec agents", () => {
    expect(Object.keys(agents).sort()).toEqual([
      "architect",
      "curator",
      "implementer",
      "ops-watcher",
      "planner",
      "reviewer",
      "test-writer",
    ]);
  });
  it("matches the roster tools and models", () => {
    expect(agents["implementer"]?.tools).toBe("Read, Grep, Glob, Edit, Write, Bash");
    expect(agents["planner"]?.tools).toBe("Read, Grep, Glob, Write");
    expect(agents["reviewer"]?.tools).toBe("Read, Grep, Glob, Bash");
    expect(agents["ops-watcher"]?.model).toBe("haiku");
    for (const [n, a] of Object.entries(agents))
      if (n !== "ops-watcher") expect(a.model, n).toBe("sonnet");
  });
  it("only the implementer-type agents can edit code; curator and reviewer cannot run Bash+Edit together", () => {
    expect(agents["reviewer"]?.tools).not.toMatch(/Edit|Write/);
    expect(agents["curator"]?.tools).not.toMatch(/Bash/);
    expect(agents["planner"]?.tools).not.toMatch(/Edit|Bash/);
  });
  it("curator can never mark content approved", () => {
    const body = readFileSync(join(REPO, ".claude/agents/curator.md"), "utf8");
    expect(body).toMatch(/proposed/);
    expect(body).toMatch(/never[^.\n]*approved/i);
  });
});

describe("CLAUDE.md", () => {
  it("stays under 150 lines and links the spec", () => {
    const t = readFileSync(join(REPO, "CLAUDE.md"), "utf8");
    expect(t.split("\n").length).toBeLessThan(150);
    expect(t).toContain("docs/spec.md");
  });
});
