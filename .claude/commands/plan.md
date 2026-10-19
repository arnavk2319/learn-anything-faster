---
description: Expand the v1 backlog into ticket files (planner), then stop at Gate 1
argument-hint: "[spec IDs or sprint, default: all unplanned tickets]"
---

You are the orchestrator. Read docs/status.md, then only the "v1 backlog" and "Test strategy" sections of docs/spec.md (grep for the heading, read the range).

1. List backlog rows in docs/backlog.md that have no file in docs/tickets/ (limit to $ARGUMENTS if given).
2. Delegate to the `planner` subagent, passing the row IDs and spec IDs only, never pasted files.
3. Confirm each new ticket has: spec IDs, depends_on, size, budget_usd, testable acceptance, status: draft. Reject v2+ scope into docs/backlog.md under Later.
4. Update docs/status.md and log your decision with scripts/log-decision.ts.
5. **Gate 1**: show the ticket table (id, title, spec, size, budget, depends_on) and stop. Do not start any build until the human sets tickets to `approved`.
