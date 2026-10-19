import { describe, expect, it } from "vitest";
import { bash, hook } from "./helpers.ts";

const env = { LAF_BRANCH: "t-001-x", DATABASE_URL: "postgres://neon.example/prod" };

describe("guard-bash blocks", () => {
  it.each([
    "git push origin main",
    "git push origin HEAD:main",
    "git push --force origin t-001-x",
    "git push -f",
    "git push origin +t-001-x",
    "git push --force-with-lease",
    "cd x && git push origin master",
    "vercel --prod",
    "vercel deploy --prod --yes",
    "vercel promote dpl_123",
    "rm -rf node_modules",
    "rm -fr .next",
    "rm -r -f dist",
    'psql "$DATABASE_URL" -c "DROP TABLE roles"',
    "psql -c 'truncate table topics'",
    "dropdb laf",
    "pnpm exec drizzle-kit push",
  ])("%s", (cmd) => {
    const r = hook("guard-bash.sh", bash(cmd), env);
    expect(r.code, r.stderr).toBe(2);
  });

  it("blocks plain git push while on main", () => {
    expect(hook("guard-bash.sh", bash("git push"), { LAF_BRANCH: "main" }).code).toBe(2);
  });
});

describe("guard-bash allows", () => {
  it.each([
    "git push -u origin t-001-scaffold",
    "git push origin t-007-roadmap-api",
    "git status",
    "git diff --stat",
    "pnpm verify",
    "pnpm test",
    "rm file.txt",
    "vercel ls",
    "git log --oneline -5",
  ])("%s", (cmd) => {
    const r = hook("guard-bash.sh", bash(cmd), env);
    expect(r.code, r.stderr).toBe(0);
  });

  it("allows drizzle-kit push against a local database", () => {
    expect(
      hook(
        "guard-bash.sh",
        bash("DATABASE_URL=postgres://u:p@localhost:5432/laf pnpm exec drizzle-kit push"),
        env,
      ).code,
    ).toBe(0);
    expect(
      hook("guard-bash.sh", bash("pnpm exec drizzle-kit push"), {
        ...env,
        DATABASE_URL: "postgres://u:p@127.0.0.1/laf",
      }).code,
    ).toBe(0);
  });
});
