---
description: Pre-release checklist before any production promote (Gate 5). Never promotes.
---

Agents never promote to production. Produce a checklist with pass/fail and evidence for each:

1. On main, clean tree, all tickets for this release `done`.
2. `pnpm verify` green; `pnpm test:security` green; `pnpm content:validate` green.
3. CI green on the release commit; smoke (`pnpm e2e:smoke`) results on the Vercel preview.
4. No proposed or dead resources served; budget report for the release (`pnpm budget`).
5. Open ADRs for any new dependency are accepted; docs/status.md is current.
   Print the checklist and stop. The human promotes in Vercel.
