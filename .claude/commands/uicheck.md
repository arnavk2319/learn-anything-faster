---
description: Run the Playwright acceptance spec for a ticket's worktree and summarise (Gate 3)
argument-hint: "<ticket id>"
---

Run `pnpm uicheck $ARGUMENTS`. It starts the worktree app on its own port with a seeded local database (or uses the PR preview URL) and runs the ticket's Playwright acceptance spec with trace, video and screenshots. Print the short summary (steps, pass/fail, a screenshot per acceptance item) and the HTML report path under test-results/$ARGUMENTS/. Tell the human they can rerun it step by step with `pnpm e2e:ui $ARGUMENTS` and should write `approve` or what is wrong in the ticket's "UI check" section. Rejections do not count toward the retry cap, but their cost counts toward the ticket budget.
