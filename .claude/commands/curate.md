---
description: Propose topics, edges and real resources for a transition on a content- branch
argument-hint: "<transition, e.g. full-stack-to-ml-engineer>"
---

You are the orchestrator. Transition: $ARGUMENTS. Content rule: agents propose, a human merges. Nothing is ever marked approved here.

1. Check budget: curator run cap is $10 (`node scripts/guard-budget.ts`). Stop at 100%.
2. `git checkout -b content-$ARGUMENTS` (content/ is editable only on content-* branches).
3. Delegate to `curator` with the transition name and the "Curation pipeline" + "Launch content" spec sections only.
4. Run `node scripts/verify-urls.ts` (2xx and title match; drops failures) and `pnpm content:validate` yourself; the curator has no Bash. Feed failures back once; then drop the resource and note it.
5. Open nothing yourself. Summarise per topic: resources kept, dropped and why. **Gate 4 (content)**: the human reviews every topic and resource and merges. A merge workflow flips proposed to approved.
   Log the decision with scripts/log-decision.ts.
