---
description: Consult mode. Ask the orchestrator anything about the project (read-only)
argument-hint: "<question>"
allowed-tools: Read, Grep, Glob, Bash(pnpm budget:*), Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git branch:*)
---

Consult mode is READ-ONLY: change no files, start no build, open no PR. A question that turns into work becomes a _draft ticket proposal_ in your reply for the human to approve.
Answer "" from the record, cheapest source first, stopping as soon as it is answered: docs/status.md, docs/tickets/_, logs/decisions/_.jsonl, docs/decisions/*, git log and diffs, test reports and Sentry issues, then code via the Explore subagent (haiku) only if still unanswered. Cite the file paths you used. Cap: 30k tokens; if the answer needs more, say what you would read and ask first.
