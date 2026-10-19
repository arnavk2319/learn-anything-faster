import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findSensitive } from "../../scripts/lib/safety";

const ROOT = join(import.meta.dirname, "..", "..");
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });

// Tracked + untracked (not ignored) files.
const files = git("ls-files", "-co", "--exclude-standard", "-z").split("\0").filter(Boolean);

const SKIP = [
  /(^|\/)node_modules\//,
  /(^|\/)\.next\//,
  /^logs\//,
  /(^|\/)runs\//,
  /(^|\/)pnpm-lock\.yaml$/,
  /^docs\/.*\.pdf$/,
];
// Files that intentionally contain fake secrets or example values. Keep this list explicit and short.
const ALLOW = new Set([
  ".env.example",
  "scripts/lib/safety.ts",
  "docker-compose.test.yml",
  "tests/integration/harness.ts",
  "tests/integration/global-setup.ts",
  "tests/security/secrets.test.ts",
  // Wireframes contain the placeholder you@example.com input hint only.
  "design/wireframes/v1/V1Roadmap.dc.html",
  "design/wireframes/v2/Signup.dc.html",
]);
const ALLOW_PREFIX = ["tests/fixtures/", "tests/tools/"];
// Exact throwaway strings (local/CI service-container Postgres) that are exempt in any file.
const FAKE_VALUES = ["postgres://postgres:postgres@localhost"];

describe("no secrets or emails in repository text files", () => {
  it("scans files and finds none", () => {
    const hits: string[] = [];
    for (const f of files) {
      if (SKIP.some((r) => r.test(f)) || ALLOW.has(f) || ALLOW_PREFIX.some((p) => f.startsWith(p)))
        continue;
      const abs = join(ROOT, f);
      try {
        const st = statSync(abs);
        if (!st.isFile() || st.size > 2_000_000) continue;
        const buf = readFileSync(abs);
        if (buf.subarray(0, 8000).includes(0)) continue; // binary
        const kind = findSensitive(
          FAKE_VALUES.reduce((s, v) => s.replaceAll(v, ""), buf.toString("utf8")),
        );
        if (kind) hits.push(`${relative(ROOT, abs)}: ${kind}`);
      } catch {
        // file vanished between listing and read
      }
    }
    expect(hits).toEqual([]);
  });
});

describe("env files", () => {
  const ignored = (p: string) => {
    try {
      git("check-ignore", "-q", p);
      return true;
    } catch {
      return false;
    }
  };
  it("ignores .env* except .env.example", () => {
    expect(ignored(".env")).toBe(true);
    expect(ignored(".env.local")).toBe(true);
    expect(ignored(".env.production")).toBe(true);
    expect(ignored(".env.example")).toBe(false);
  });
  it("lists no real .env file as tracked or untracked", () => {
    expect(files.filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example"))).toEqual([]);
  });
});

describe("dependency pinning", () => {
  const manifests = files.filter((f) => f.endsWith("package.json") && !f.includes("node_modules/"));
  it("finds at least the root manifest", () => {
    expect(manifests).toContain("package.json");
  });
  for (const m of manifests) {
    it(`${m} pins every dependency exactly`, () => {
      const pkg = JSON.parse(readFileSync(join(ROOT, m), "utf8")) as Record<string, unknown>;
      const loose: string[] = [];
      for (const field of [
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
      ]) {
        const deps = (pkg[field] ?? {}) as Record<string, string>;
        for (const [name, range] of Object.entries(deps)) {
          if (/^(workspace|link|file):/.test(range)) continue;
          if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(range))
            loose.push(`${field}.${name}@${range}`);
        }
      }
      expect(loose).toEqual([]);
    });
  }
});
