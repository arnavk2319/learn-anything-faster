import { describe, expect, it } from "vitest";
import { edit, hook, REPO } from "./helpers.ts";

const abs = (p: string) => `${REPO}/${p}`;

describe("guard-paths", () => {
  it.each([
    ".env",
    ".env.local",
    "apps/web/.env.production",
    "secrets/key.txt",
    ".github/workflows/ci.yml",
    ".claude/settings.json",
    ".claude/hooks/guard-paths.sh",
  ])("blocks %s", (p) => {
    const r = hook("guard-paths.sh", edit(abs(p)), { LAF_BRANCH: "t-001-x" });
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("guard-paths");
  });

  it("blocks path traversal", () => {
    expect(hook("guard-paths.sh", edit(abs("apps/../.env")), { LAF_BRANCH: "t-001-x" }).code).toBe(
      2,
    );
  });

  it.each([
    "apps/web/app/page.tsx",
    "packages/graph/src/index.ts",
    "docs/tickets/T-001.md",
    ".env.example",
    "scripts/verify.ts",
  ])("allows %s", (p) => {
    expect(hook("guard-paths.sh", edit(abs(p)), { LAF_BRANCH: "t-001-x" }).code).toBe(0);
  });

  it("blocks content/ on a feature branch and allows it on content-*", () => {
    expect(
      hook("guard-paths.sh", edit(abs("content/roles.yaml")), { LAF_BRANCH: "t-005-schemas" }).code,
    ).toBe(2);
    expect(
      hook("guard-paths.sh", edit(abs("content/roles.yaml")), { LAF_BRANCH: "main" }).code,
    ).toBe(2);
    expect(
      hook("guard-paths.sh", edit(abs("content/roles.yaml")), {
        LAF_BRANCH: "content-fullstack-to-ml",
      }).code,
    ).toBe(0);
  });

  it("lets the human override with LAF_ALLOW_PROTECTED=1", () => {
    expect(
      hook("guard-paths.sh", edit(abs(".claude/settings.json")), { LAF_ALLOW_PROTECTED: "1" }).code,
    ).toBe(0);
  });
});
