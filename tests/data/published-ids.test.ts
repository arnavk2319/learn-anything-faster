// Topic ids never change once published (CLAUDE.md seam). tests/data/published-ids.json pins every id shipped in
// v0.1.0; this fails if one is removed or renamed in content/. Adding ids is fine: append them to the JSON on release.
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPublished, validateContent } from "../../scripts/lib/content/validate.ts";

const published = readPublished(join(process.cwd(), "tests/data/published-ids.json"));

describe("published ids are immutable", () => {
  it("pins the shipped ids (23 topics, 2 roles)", () => {
    expect(published.topics).toHaveLength(23);
    expect(published.roles).toEqual(["full-stack-engineer", "ml-engineer"]);
  });

  it("real content still contains every published topic and role id", () => {
    const { content, errors } = validateContent(join(process.cwd(), "content"), published);
    expect(errors.filter((e) => /exists in production/.test(e))).toEqual([]);
    const topics = new Set(content.topics.map((t) => t.item.id));
    for (const id of published.topics ?? []) expect(topics.has(id), `topic ${id}`).toBe(true);
    const roles = new Set(content.roles.map((r) => r.item.id));
    for (const id of published.roles ?? []) expect(roles.has(id), `role ${id}`).toBe(true);
  });

  it("detects a renamed id", () => {
    const { errors } = validateContent(join(process.cwd(), "content"), {
      topics: [...(published.topics ?? []), "renamed-away"],
    });
    expect(errors.join("\n")).toMatch(/topic id "renamed-away" exists in production/);
  });
});
