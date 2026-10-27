import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  res,
  validFixture,
  writeFixture,
  type Fixture,
} from "../../../tests/fixtures/content-fixture.ts";
import { validateContent } from "./validate.ts";

function errorsFor(mutate: (f: Fixture) => void, published = {}) {
  const f = validFixture();
  mutate(f);
  return validateContent(writeFixture(f), published).errors;
}

describe("content:validate", () => {
  it("accepts a valid fixture", () => {
    expect(errorsFor(() => {})).toEqual([]);
  });

  it("fails on a schema error", () => {
    const e = errorsFor((f) => {
      (f.roles as { status: string }[])[0]!.status = "maybe";
    });
    expect(e.join("\n")).toMatch(/roles\.yaml: schema: 0\.status/);
  });

  it("fails on an unknown id reference", () => {
    const e = errorsFor((f) => {
      (f.roleTopics as { requires?: string[] }[])[1]!.requires = ["stats", "nope"];
    });
    expect(e.join("\n")).toMatch(/unknown reference: ml-dev requires "nope"/);
  });

  it("fails on a prerequisite cycle", () => {
    const e = errorsFor((f) => {
      const m = f.topics.math as { topics: { id: string; learn_first?: string[] }[] };
      m.topics[0]!.learn_first = ["stats"];
    });
    expect(e.join("\n")).toMatch(/prerequisite cycle: .*->/);
  });

  it("fails on a duplicate id", () => {
    const e = errorsFor((f) => {
      const c = f.topics.coding as { topics: unknown[] };
      c.topics.push({ id: "algebra", name: "Dup", why: "x", est_hours: 1 });
    });
    expect(e.join("\n")).toMatch(/duplicate topic id "algebra"/);
  });

  it("fails when a live-role topic has no approved resource", () => {
    const e = errorsFor((f) => {
      f.resources.stats = res("stats", "proposed");
    });
    expect(e.join("\n")).toMatch(/topic "stats": in a live role but has no approved resource/);
  });

  it("also requires approved resources for transitive prerequisites", () => {
    const e = errorsFor((f) => {
      f.resources.algebra = res("algebra", "proposed");
    });
    expect(e.join("\n")).toMatch(/topic "algebra"/);
  });

  it("fails when a published id is changed or removed", () => {
    const e = errorsFor(() => {}, { topics: ["algebra", "old-stats-id"] });
    expect(e.join("\n")).toMatch(/topic id "old-stats-id" exists in production/);
  });

  it("CLI prints failures only: silent on valid, lists errors and exits 1 on invalid", () => {
    const run = (dir: string) =>
      spawnSync("pnpm", ["--silent", "content:validate", dir], { encoding: "utf8" });
    const ok = run(writeFixture(validFixture()));
    expect(ok.status).toBe(0);
    expect(ok.stdout.trim()).toBe("");
    const bad = validFixture();
    bad.resources.stats = res("stats", "proposed");
    const r = run(writeFixture(bad));
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/✗ topic "stats"/);
  });
});
