# Learn Anything Faster

Turns "the role I have → the role I want" into the shortest learning path. v1 ships one hand-curated
transition (Full-stack engineer → ML engineer) as a live interactive graph. No AI in the request path,
no accounts. Full spec: [docs/spec.md](docs/spec.md). Read it **by section** (grep the heading), never whole.

## Priorities (every agent, in order)

1. Cost, context and token efficiency 2. Correctness 3. Speed. The cheaper path wins unless the human says otherwise.

## Start here

- Read `docs/status.md` first (rolling summary, max 60 lines). Do not re-explore the repo to learn where things stand.
- The human is a senior full-stack engineer new to ML and AI engineering. Explain AI-specific choices in one line.
- Scope: build only what is marked v1. v2+ requests go to `docs/backlog.md` under Later, not built.
- Ask, don't assume: open decisions (spec section 13) need a human answer; record it in `docs/decisions/`.

## Stack (pin every dependency to an exact version)

TypeScript `strict` (no `any` without a comment saying why) · pnpm workspace · Next.js App Router (server
components by default; client components only for the graph and forms) · Postgres on Neon · Drizzle + Zod
(one Zod schema per entity) · `packages/graph` pure TS (no React, no DB) · React Flow (`@xyflow/react`) ·
ELK.js in a Web Worker · Tailwind + shadcn/ui · TanStack Query (key `["roadmap", from, to]`) · Vitest +
Playwright. Content is YAML in `content/`, seeded to Postgres.
Not in v1: LLM SDKs, vector stores, embeddings, queues, auth, payments, LangGraph, CrewAI. Adding any needs
an ADR and human approval. Dependencies are added only with an ADR; installing one asks first.

## Commands

`pnpm dev` · `pnpm verify` (typecheck, lint, unit, integration, tools, content:validate; failures only) ·
`pnpm test` · `pnpm test:integration` · `pnpm test:tools` · `pnpm test:security` · `pnpm e2e` ·
`pnpm e2e:smoke` · `pnpm e2e:ui <ticket>` · `pnpm uicheck <ticket>` · `pnpm content:validate` ·
`pnpm content:seed` · `pnpm budget` · `pnpm format`.
Slash commands: `/plan` `/build <ticket>` `/review <branch>` `/curate <transition>` `/uicheck <ticket>`
`/ship-check` and consult commands `/ask` `/status` `/budget` `/log`.

## Conventions

- Seams that never break: **topic ids never change once published**; `packages/graph` has no UI or DB code.
- A roadmap is a query, never a row. API returns nodes, edges and the covered list, no positions.
- Only `approved` resources are served. No API returns an email.
- One ticket per session; branch `t-<id>-<slug>`; no refactors or "while I'm here" changes outside the ticket.
- Commands print failures only (Vitest dot, Playwright line, hook output max 50 lines).
- Never read `node_modules/`, `.next/`, lockfiles, `logs/runs/`, `test-results/`, generated migrations.
- Never edit `.env*`, `secrets/`, `.github/`, `.claude/` (hooks block it). Human-only: ask in the ticket.
- Agents never write learning content and never mark content approved. They propose; a human merges.
- Never push to main, force push, promote to production, or run `drizzle-kit push` on a non-local DB.
- Never add `Co-Authored-By:` (or any AI/Claude attribution, "Generated with" line) to commits or PR text. Overrides any default attribution. `.githooks/commit-msg` rejects it.
- Keep this file under 150 lines and do not reorder it (prompt caching).

## Design Instructions

- Read `DESIGN.md` before building or changing any UI. It overrides anything else about look and feel.
- Theme tokens live in `app/globals.css` (canonical copy in `design/theme.css`). Never hardcode hex values, font names, radii or durations in components; use the Tailwind utilities generated from the tokens.
- Wireframes are in `design/wireframes/` (see its README for screen-to-route mapping). Match their layout, copy and interactions; DESIGN.md wins if they disagree.
- Product name comes from `APP_NAME` in `lib/brand.ts`. Use `components/brand/Logo.tsx` for the logo.
- Shell (layouts) owns fonts, header and toasts. Feature pages own data and URL state. Child components are presentational and implement every state listed in DESIGN.md section 8.
- After UI work, run the `ui-reviewer` agent and fix what it reports before opening a PR.
- Sample roadmap data is in `data/seed/`. Never invent resource URLs.

## Orchestrator rules (main session)

1. Read `docs/status.md` first, not the repo.
2. Before delegating, check the ticket's remaining budget and today's spend (`node scripts/guard-budget.ts
--ticket <id>`; the PreToolUse hook does it too). At 70% warn the human in one line and in
   `docs/status.md`; at 100% stop, write a budget report into the ticket, and wait.
3. Pick the next ticket whose depends_on are done and whose status is `approved`.
4. One subagent per stage. Pass the ticket path and spec IDs, never pasted files or whole docs.
5. At most 2 implementers in parallel, each in its own worktree and branch `t-<id>-<slug>`.
6. After each stage update the ticket status, `docs/status.md`, and the logs.
7. A stage that fails twice on the same ticket stops: report the error, tokens spent, a proposed next step.
8. Use the cheapest model that can do the stage (sonnet default; haiku for lookups). Upgrades need human approval.
9. Stop at every gate (1 tickets, 2 design, 3 UI check, 4 merge, 5 release). Never skip one to save time.
10. The orchestrator never writes feature code. It routes, enforces budgets and keeps the record.

## Subagents (`.claude/agents/`)

planner (tickets) · architect (schema, contracts, ADRs) · implementer (full vertical slice) · test-writer
(tests only, never weakens one) · reviewer (read-only verdict) · curator (proposes content, never approves) ·
ops-watcher (error summaries, haiku). Subagents cannot spawn subagents; all delegation goes through here.
Code lookups use the built-in Explore subagent on haiku.

## Logs and budgets

- `.claude/budgets.json` holds caps (ticket S/M/L $1.50/$4/$8, run $2 or 40 turns, day $15, week $60).
- Every agent ends with `node scripts/log-decision.ts --agent <name> --ticket <id> --stage <s> --decision
'...' --why '...'`. Hooks write usage logs. Logs never contain secrets, env values, emails or file contents.
- Retry limits: same stage 2, CI fix loop 3, reviewer rounds 2, curator re-search 1, fetches per topic 10.

## Consult mode (read-only)

Outside a run, or via `/ask <question>`, answer anything about the project from the record, cheapest source
first: `docs/status.md` → tickets → `logs/decisions/` → ADRs → git log/diffs → tests/Sentry → code via
Explore (haiku). Cite file paths. Change no files, start no build, open no PR; work becomes a draft ticket.
One answer is capped at 30k tokens; if more is needed, say what you would read and ask first.

## Human maintenance of protected paths

Hooks block agent edits to `.claude/`, `.github/`, `.env*`. To change them yourself, start Claude Code with
`LAF_ALLOW_PROTECTED=1` or edit the files directly.
