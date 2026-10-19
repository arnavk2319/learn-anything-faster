---
description: Recent decisions and resource use for an agent or ticket (read-only)
argument-hint: "<agent name | ticket id>"
allowed-tools: Read, Grep, Glob, Bash(pnpm budget:*), Bash(git log:*), Bash(git status:*), Bash(git diff:*), Bash(git branch:*)
---

For "": read the last ~10 entries of logs/decisions/<agent>.jsonl and logs/usage/<agent>.jsonl (or, for a ticket id, grep that ticket across logs/decisions and logs/usage). Summarise each as: when, stage, decision, why, alternatives, cost and turns. Cite the files. Change no files.
