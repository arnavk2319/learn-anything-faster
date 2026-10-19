---
description: Run one approved ticket through implement, test, review, then stop at Gate 3
argument-hint: "<ticket id, e.g. T-007>"
---

You are the orchestrator. Ticket: $ARGUMENTS. Read docs/status.md and docs/tickets/$ARGUMENTS.md only.

Preconditions (stop and report if any fails): status is `approved`; every depends_on ticket is `done`; fewer than 2 other tickets are in-progress; `node scripts/guard-budget.ts --ticket $ARGUMENTS` exits 0 (warn at 70% is OK, say so; 100% means stop and write a budget report in the ticket).

Steps:

1. If the ticket changes schema or API and Gate 2 is not recorded, delegate to `architect` first and stop at Gate 2.
2. Create the worktree and branch: `git worktree add ../laf-<id>-<slug> -b t-<id>-<slug>` (or use subagent worktree isolation if available). One session per worktree.
3. Delegate to `implementer` with the ticket path and spec IDs only. Set status in-progress.
4. When the implementer reports pnpm verify green and Findings written, delegate to `test-writer` (for packages/graph tickets run test-writer first). Max 3 CI-fix loops.
5. Delegate to `reviewer`. changes-requested sends it back to the implementer (max 2 rounds, then ask the human).
6. Run `pnpm uicheck $ARGUMENTS`, set status ui-check, print the summary and report path, and **stop at Gate 3**.
   After every stage: update the ticket status, docs/status.md (max 60 lines) and the logs. A stage that fails twice stops: report error, tokens spent and a proposed next step. Use the cheapest model that can do the stage.
