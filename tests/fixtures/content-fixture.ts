// Builds a throwaway content/ dir from plain objects, so each failure case is a one-line mutation.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";

export interface Fixture {
  roles: unknown;
  topics: Record<string, unknown>; // area file name -> contents
  roleTopics: unknown;
  resources: Record<string, unknown>; // topic id -> contents
}

export function validFixture(): Fixture {
  return {
    roles: [
      { id: "dev", name: "Developer", status: "live" },
      { id: "ml-dev", name: "ML developer", status: "live" },
      { id: "later-role", name: "Later", status: "coming_soon" },
    ],
    topics: {
      math: {
        area: "math",
        topics: [
          { id: "algebra", name: "Algebra", why: "Base.", est_hours: 5 },
          {
            id: "stats",
            name: "Stats",
            why: "Needs algebra.",
            est_hours: 8,
            learn_first: ["algebra"],
          },
        ],
      },
      coding: {
        area: "coding",
        topics: [{ id: "python", name: "Python", why: "Lingua franca.", est_hours: 4 }],
      },
    },
    roleTopics: [
      { role: "dev", covers: ["python"] },
      { role: "ml-dev", requires: ["stats", "python"], covers: [] },
    ],
    resources: {
      algebra: res("algebra", "approved"),
      stats: res("stats", "approved"),
      python: res("python", "approved"),
    },
  };
}

export function res(topic: string, status: "proposed" | "approved" | "dead" = "approved") {
  return {
    topic,
    resources: [
      {
        id: `${topic}-docs`,
        type: "docs",
        title: `${topic} docs`,
        url: `https://example.com/${topic}`,
        is_free: true,
        status,
      },
    ],
  };
}

export function writeFixture(f: Fixture): string {
  const dir = mkdtempSync(join(tmpdir(), "laf-content-"));
  mkdirSync(join(dir, "topics"));
  mkdirSync(join(dir, "resources"));
  writeFileSync(join(dir, "roles.yaml"), stringify(f.roles));
  writeFileSync(join(dir, "role-topics.yaml"), stringify(f.roleTopics));
  for (const [k, v] of Object.entries(f.topics))
    writeFileSync(join(dir, "topics", `${k}.yaml`), stringify(v));
  for (const [k, v] of Object.entries(f.resources))
    writeFileSync(join(dir, "resources", `${k}.yaml`), stringify(v));
  return dir;
}
