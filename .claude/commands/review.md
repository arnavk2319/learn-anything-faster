---
description: Review a branch with the reviewer subagent (read-only)
argument-hint: "<branch, e.g. t-007-roadmap-api>"
---

Delegate to the `reviewer` subagent for branch $ARGUMENTS against main. Pass the branch name and the ticket path (derive T-<id> from the branch), never pasted diffs. Relay the verdict block only, and write it into the ticket's Review section. Do not edit code.
