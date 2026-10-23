import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

describe("guard-bash fast-lane rules", () => {
  const gh = { LAF_BRANCH: "", DATABASE_URL: "" };

  it.each([
    "gh pr merge 12",
    "gh pr merge 12 --squash",
    "gh pr create --base main --title x",
    "gh pr create --base=main",
  ])("blocks %s", (cmd) => {
    const r = hook("guard-bash.sh", bash(cmd), gh);
    expect(r.code, r.stderr).toBe(2);
  });

  it.each([
    "gh pr merge 12 --auto --squash",
    "gh pr create --base mvp --title 'feat: x'",
    "gh pr view 12",
    "gh pr checks 12",
  ])("allows %s", (cmd) => {
    const r = hook("guard-bash.sh", bash(cmd), gh);
    expect(r.code, r.stderr).toBe(0);
  });
});

describe("guard-bash reads the branch from the command's checkout", () => {
  const repoOn = (branch: string): string => {
    const dir = mkdtempSync(join(tmpdir(), "laf-git-"));
    execFileSync("git", ["init", "-q", "-b", branch], { cwd: dir });
    return dir;
  };
  const env = { LAF_BRANCH: "" };

  it("allows a push from a worktree on a t- branch even when the project root is elsewhere", () => {
    const dir = repoOn("t-005-content");
    const r = hook("guard-bash.sh", { ...bash("git push -u origin t-005-content"), cwd: dir }, env);
    expect(r.code, r.stderr).toBe(0);
  });

  it("blocks a push from a checkout on main", () => {
    const dir = repoOn("main");
    expect(hook("guard-bash.sh", { ...bash("git push"), cwd: dir }, env).code).toBe(2);
  });

  it("follows a leading cd into the target checkout", () => {
    const main = repoOn("main");
    const feat = repoOn("t-005-content");
    expect(hook("guard-bash.sh", { ...bash(`cd ${main} && git push`), cwd: feat }, env).code).toBe(
      2,
    );
    expect(hook("guard-bash.sh", { ...bash(`cd ${feat} && git push`), cwd: main }, env).code).toBe(
      0,
    );
  });

  it("follows git -C into the target checkout", () => {
    const main = repoOn("main");
    const feat = repoOn("t-005-content");
    expect(hook("guard-bash.sh", { ...bash(`git -C ${main} push`), cwd: feat }, env).code).toBe(2);
    expect(hook("guard-bash.sh", { ...bash(`git -C ${feat} push`), cwd: main }, env).code).toBe(0);
  });
});
