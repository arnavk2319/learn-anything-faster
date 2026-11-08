// Shared axe check (ADR-0011, T-031). Fails on serious/critical WCAG 2.x A/AA violations, including
// colour contrast. Minor/moderate are logged as a one-line count only.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export type AllowEntry = {
  ruleId: string;
  selector: string;
  /** Written justification with a ticket or ADR reference. Reviewers reject entries without one. */
  reason: string;
};

// Target: zero entries. Add one only for a proven false positive (for example React Flow canvas
// internals) and list it in the ticket Findings.
const ALLOWLIST: AllowEntry[] = [];

type Opts = { label?: string; include?: string; allow?: AllowEntry[] };

export async function expectNoA11yViolations(page: Page, opts: Opts = {}): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (opts.include) builder = builder.include(opts.include);
  const allow = [...ALLOWLIST, ...(opts.allow ?? [])];
  for (const a of allow) {
    if (!a.reason.trim()) throw new Error(`allowlist entry for ${a.ruleId} needs a reason`);
  }
  for (const a of allow) builder = builder.exclude(a.selector);
  const { violations } = await builder.analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const minor = violations.length - blocking.length;
  if (minor > 0) console.log(`a11y ${opts.label ?? page.url()}: ${minor} minor/moderate`);
  const report = blocking.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(" ")} ${n.any[0]?.message ?? n.failureSummary ?? ""}`)
        .join(" | ")}`,
  );
  expect(report, `axe serious/critical on ${opts.label ?? page.url()}`).toEqual([]);
}
