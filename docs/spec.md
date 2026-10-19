# Learn Anything Faster — Build Spec for Claude Code

Markdown copy of `docs/Build Spec for Claude Code.pdf` (Oct 18, 2026). Where this disagrees with the scope plan or the tech-stack doc, **this doc wins**. Agents read it **by section**, never whole.

## 0. How Claude Code uses this doc

- Source of truth for v1. First session: set up repo and multi-agent framework, then **stop for human approval** before any feature code.
- **Scope rule:** build only what is marked v1. Anything touching v2+ is logged in `docs/backlog.md` (Later), not built.
- **Ask, don't assume:** items under Open decisions need a human answer. Ask once, record in `docs/decisions/`, continue.
- **Content rule:** agents never write learning content and never mark content approved. They propose; a human merges.
- **Human:** one senior full-stack engineer, new to ML and AI engineering. Explain AI-specific choices in one line when making them.
- **Priority for every agent:** 1) cost, context and token efficiency, 2) correctness, 3) speed. The cheaper path wins unless the human says otherwise.

## 1. Product and scope

Turns "the role I have → the role I want" into the shortest learning path. v1 ships one hand-curated transition, **Full-stack engineer → ML engineer**, as a live interactive graph, no AI in the request path, no accounts.

- Target user: software engineers moving into AI/ML engineering. Builder is user zero.
- Content principle: hand-curated, grounded in real sources (courses, videos, docs, articles), never LLM-generated.
- Edge over roadmap.sh: show only the delta from the user's current role (v1), then measure level instead of self-report (v2).
- Out of scope v1: accounts, progress tracking, assessment, tutoring, generated content, payments, email sending.
- Success signals: roadmap opens and resource clicks per visitor, share-link copies, request and notify-me volume per transition.

| Version | Theme               | Ships                                                                                                                               | Build status             |
| ------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| v1      | Roadmap builder     | Role picker, computed delta roadmap as interactive graph, topic panel with curated resources, share link, request and suggest forms | Build now (~2 weeks)     |
| v2      | Skip what you know  | Gap detector, knowledge map (Known/Bridge/New), gap-only path, LLM tutor, mastery check, dashboard, accounts, paywall               | Do not build; keep seams |
| v3      | Retention and depth | Re-tests, spaced review, concept diagrams, goal from job description or repo, more tracks                                           | Do not build             |
| v4      | Expansion           | Open topics, non-tech "just enough X" paths, in-browser code runner, project milestones, teams                                      | Do not build             |

## 2. v1 requirements (each ID → ticket(s); acceptance line → test)

| ID  | Requirement                       | Acceptance                                                                                                                             |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Pick current role and target role | A curated pair opens its roadmap; an uncurated pair shows the Request-it email form                                                    |
| F2  | Compute the roadmap               | `requires(to) − covers(from) + uncovered prerequisites (transitive)`, topologically ordered; unit-tested on fixtures including a cycle |
| F3  | Interactive graph                 | Pan, zoom, expand/collapse areas, click a topic to open its panel                                                                      |
| F4  | Topic panel                       | Shows why, what to learn first, approved resources with type, free/paid, outbound link                                                 |
| F5  | Change roles in place             | Changing either role re-renders the graph with no page reload                                                                          |
| F6  | Share link                        | `/roadmap?from=<role>&to=<role>` reproduces the same graph; copy-link button fires an analytics event                                  |
| F7  | Capture demand                    | Request a transition, Notify me on Coming soon, Suggest a resource per topic; all stored, Turnstile-protected                          |
| F8  | Curation with review              | Roles, topics, edges, resources change only through a merged PR; only approved resources served                                        |
| F9  | Browse roadmaps                   | Catalog of transitions filterable by Live / Coming soon                                                                                |
| F10 | List view                         | Same JSON renders as an accessible nested list (screen readers, small screens, layout failure)                                         |

Non-functional: graph visible within ~1 s and role change feels instant; a few hundred topics per roadmap with layout in a Web Worker; free/hobby tiers and **zero model calls on user requests**; every topic reachable by keyboard, WCAG AA contrast; nothing ships without human approval and links are checked daily; data model and graph module reused unchanged in v2.

**Launch content (Full-stack engineer → ML engineer):**

| Area                    | Topics                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Math foundations        | Linear algebra, probability & statistics, calculus for gradients                              |
| Python for ML           | NumPy, pandas, Matplotlib basics                                                              |
| Classical ML            | Supervised learning basics, regression, classification, model evaluation, feature engineering |
| Deep learning           | Neural networks, backpropagation & training, CNNs, transformers                               |
| MLOps                   | Experiment tracking, model serving, model monitoring                                          |
| Covered by current role | Python basics, Git, REST APIs, Docker, SQL                                                    |

## 3. Tech stack

One TypeScript Next.js app on Vercel with serverless Postgres; no separate backend in v1. **Pin every dependency to an exact version.**

| Layer           | Choice                                                                                            | Rule for agents                                                                |
| --------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Language        | TypeScript, `strict: true`                                                                        | No `any` without a comment saying why                                          |
| Package manager | pnpm                                                                                              | One lockfile, committed                                                        |
| App             | Next.js App Router                                                                                | Server components by default; client components only for the graph and forms   |
| Hosting         | Vercel                                                                                            | Preview deploy per PR; Vercel Cron for scheduled jobs                          |
| Database        | Serverless Postgres, **Neon** (D1)                                                                | Preview branches get their own DB branch                                       |
| ORM/schema      | Drizzle ORM + Zod                                                                                 | One Zod schema per entity validates DB rows, API payloads and content files    |
| Graph logic     | Plain TS module `packages/graph`                                                                  | No React, no DB imports; pure functions only                                   |
| Graph rendering | React Flow (`@xyflow/react`)                                                                      | Custom node components; no canvas libraries                                    |
| Graph layout    | ELK.js in a Web Worker                                                                            | Layered layout; areas as compound nodes                                        |
| UI kit          | Tailwind CSS + shadcn/ui                                                                          | Use existing primitives before writing new ones                                |
| Client data     | TanStack Query                                                                                    | Query key = `["roadmap", from, to]`                                            |
| Content source  | YAML in `content/`, seeded to Postgres                                                            | Agents may only open PRs against it                                            |
| Forms           | Server actions + Cloudflare Turnstile                                                             | No email sending in v1                                                         |
| Analytics       | PostHog                                                                                           | Event names defined in one `lib/analytics.ts`                                  |
| Errors          | Sentry                                                                                            | Client and server                                                              |
| Tests           | Vitest, Playwright                                                                                | Unit, integration, E2E, smoke, security (gitleaks, Semgrep), data, tool-safety |
| CI              | GitHub Actions                                                                                    | Typecheck, lint, test, content validate on every PR                            |
| Agentic build   | Claude Code subagents, hooks, CLAUDE.md; Agent SDK or Claude Code GitHub Action for headless runs | See section 5                                                                  |

**Not in v1:** LLM SDKs, vector stores, embeddings, queues, auth, payments, LangGraph, CrewAI. Adding any needs a decision record and human approval.

## 4. Architecture

One Next.js app serves UI, roadmap API, forms and the link-check cron; Postgres holds curated content and submissions. No model calls at runtime.

**Roadmap request flow**

1. Browser calls `GET /api/roadmap?from=<role>&to=<role>`; the same pair is in the page URL.
2. Resolve: load `requires(to)`, `covers(from)`, all prerequisite edges, approved resources for resulting topics.
3. Compute: `packages/graph` returns the delta, its prerequisite closure, a topological order.
4. Respond: JSON with nodes (topic, area, resources), edges, covered list. **No positions.**
5. Cache per role pair at the edge; revalidate on content deploy. Computation stays dynamic.
6. Lay out: Web Worker runs ELK layered, each area a compound node.
7. Render: React Flow custom nodes; click opens panel; areas expand/collapse; role change refetches via TanStack Query and animates.
8. Fallback: same JSON renders as the accessible nested list.

**Data model** (7 tables; 5 curated content seeded from YAML, 2 user-generated; a roadmap is a query, never a row)

| Table                | Key columns                                                                   | Notes                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| roles                | id (slug), name, status (live / coming_soon)                                  | A role can be current, target or both                                                                                      |
| topics               | id (slug), name, area, why, est_hours                                         | Becomes v2 skill-graph node; **id never changes once published**                                                           |
| topic_edges          | topic_id, prerequisite_id                                                     | Directed, acyclic; checked in CI                                                                                           |
| role_topics          | role_id, topic_id, kind (requires / covers)                                   | requires builds target tree, covers builds skip set                                                                        |
| resources            | id, topic_id, type, title, url, is_free, status, last_checked_at, source_note | status = proposed / approved / dead; **only approved served**. type ∈ youtube, coursera, course, book, docs, blog, article |
| transition_requests  | id, from_role, to_role, email, kind (request / notify), created_at            | Unique on (from_role, to_role, email, kind)                                                                                |
| resource_suggestions | id, topic_id, url, note, created_at                                           | Feeds curation pipeline                                                                                                    |

**Content files** (one file per entity type; validated in CI and pre-commit)

```
content/
  roles.yaml           # id, name, status
  topics/<area>.yaml   # topics; learn_first seeds topic_edges
  role-topics.yaml     # role → requires[] / covers[]
  resources/<topic-id>.yaml
```

`pnpm content:validate` must fail on: Zod schema error, unknown id in any reference, prerequisite cycle, duplicate id, a topic with no approved resource in a live role, a changed id that already exists in production.

**Roadmap(from, to)** = `requires(to) − covers(from) + every transitive prerequisite not in covers(from)`, sorted topologically.

**Repository layout** (pnpm workspace: one app + one pure graph package)

```
CLAUDE.md                   # conventions, commands, link to docs/spec.md (<150 lines)
.claude/{settings.json,budgets.json,agents/,commands/,hooks/}
docs/{spec.md,status.md,backlog.md,decisions/,tickets/}
logs/{decisions/,usage/,summary/,runs/}   # runs gitignored, 14 days
apps/web/{app/,components/graph/,db/,lib/}
packages/graph/             # delta, closure, topo sort; pure TS + Vitest
content/  scripts/  tests/{integration,security,tools}/  e2e/  .github/workflows/
```

Routes: `/`, `/roadmaps`, `/roadmap`, `/api/roadmap`, `/api/health`, `/api/cron/link-check`.
Root scripts: `pnpm dev|typecheck|lint|test|test:integration|test:security|test:tools|e2e|e2e:smoke|e2e:ui <ticket>|uicheck <ticket>|content:validate|content:seed|budget|verify`. `verify` = typecheck, lint, unit, integration, tools, content:validate, failures only.

## 5. Multi-agent framework

The main Claude Code session is the **orchestrator**. It delegates each stage to a project subagent in `.claude/agents/`, passing work only through files in `docs/` and git branches. Subagents cannot spawn subagents.

**Orchestrator rules**

1. Read `docs/status.md` first (rolling summary, ≤60 lines, rewritten after every stage) instead of re-reading the repo.
2. Before delegating, check the ticket's remaining budget and today's spend; at 70% warn the human, at 100% stop.
3. Pick the next ticket whose dependencies are done and whose status is `approved`.
4. One subagent per stage; pass the ticket path and spec IDs, never pasted files or whole docs.
5. At most 2 implementers in parallel, each in its own git worktree and branch `t-<id>-<slug>`.
6. After each stage, update ticket status, `docs/status.md`, and agent logs.
7. A stage that fails twice on the same ticket stops; report error, tokens spent, proposed next step.
8. Cheapest model that can do the stage; a model upgrade needs human approval.
9. Stop and ask at every gate. Never skip a gate to save time.

**Subagent roster**

| Agent               | Job                                                                                                                      | Tools                                              | Model                          | Writes to                             | Never                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------ | ------------------------------------- | ----------------------------------- |
| orchestrator (main) | Route work, enforce budgets, keep status, answer consult questions                                                       | All; mostly reads                                  | sonnet                         | docs/backlog.md, docs/status.md, logs | Writes feature code                 |
| planner             | Spec sections → tickets with acceptance, size S/M/L, budget, deps                                                        | Read, Grep, Glob, Write                            | sonnet                         | docs/tickets/, docs/backlog.md        | Writes code                         |
| architect           | Schema changes, API contracts, ADRs for any new dependency                                                               | Read, Grep, Glob, Write                            | sonnet (opus on human request) | docs/decisions/, contract stubs       | Implements features                 |
| implementer         | One feature as a full vertical slice (schema, server, API, UI) on its branch until `pnpm verify` passes; writes Findings | Read, Grep, Glob, Edit, Write, Bash                | sonnet                         | apps/, packages/, scripts/            | Edits content/, .env*, CI, .claude/ |
| test-writer         | Unit, integration, E2E, smoke tests from acceptance + Findings                                                           | Read, Grep, Glob, Edit, Write, Bash                | sonnet                         | `**/*.test.ts`, e2e/                  | Weakens or deletes an existing test |
| reviewer            | Review diff against ticket, spec, Findings, security; verdict                                                            | Read, Grep, Glob, Bash (read-only git)             | sonnet                         | Ticket review block or PR comment     | Edits code                          |
| curator             | Propose topics, edges, real resources; fix dead links                                                                    | Read, Grep, Glob, Edit, Write, WebSearch, WebFetch | sonnet                         | content/ with status `proposed` only  | Sets `approved`; writes lesson text |
| ops-watcher         | Summarise Sentry and Vercel log errors into issues                                                                       | Read, Bash, Vercel MCP                             | haiku                          | docs/ops/ or GitHub issues            | Changes code or config              |

Code lookups use Claude Code's built-in Explore subagent on haiku.

**Implementer scope:** one agent per vertical slice (frontend + backend together, one worktree). Splitting is rejected for v1; revisit only for an L ticket as decision D10. On finishing, write a **Findings** section in the ticket: files changed, API contract as built, edge cases handled, known gaps, steps to see the feature in the UI. Test-writer and reviewer read Findings plus the diff, not the codebase.

**Subagent file template**

```
---
name: implementer
description: Implements one approved ticket as a full vertical slice (schema, server, API, UI) on its own branch. Use for any ticket in status approved with type feature or fix.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---
You implement exactly one ticket. Read docs/status.md, the ticket file, and only the spec sections it names. Search with Grep/Glob before reading; read line ranges, not whole files. Work only on branch t-<id>-<slug>. Touch only files the ticket names or clearly implies; no refactors outside the ticket.
Budget: the ticket file states your token budget. If you expect to exceed it, stop and say so instead of continuing.
Done means: acceptance criteria met, pnpm verify passes, the Findings section is written, and one decision entry is appended with scripts/log-decision.
Do not edit content/, .env*, .github/ or .claude/. If the ticket is ambiguous, stop and write the question into the ticket instead of guessing.
```

**Ticket file contract**

```
# T-007 Roadmap API returns delta graph
status: draft | approved | in-progress | in-review | ui-check | changes-requested | done
spec: F2, F6
depends_on: [T-003, T-005]
size: M
budget_usd: 4.00
spent_usd: 0.00
retries: 0
owner_agent: implementer
## Acceptance
- [ ] ...
## Findings (implementer)
## Tests (test-writer)
## Review (reviewer)
## UI check (human, Gate 3)
```

**Consult mode.** The human can ask the orchestrator anything outside a run (plain session or `/ask <question>`). Read-only: no file changes, no builds, no PRs; a question that turns into work becomes a draft ticket. Answer from cheapest source first: `docs/status.md` → tickets → decision logs → ADRs → git log/diffs → test reports/Sentry → code via Explore on haiku. Cite file paths. Cap one answer at 30k tokens; if more is needed, say what would be read and ask first. Helpers: `/status`, `/budget`, `/log <agent|ticket>`.

**Agent logs.** Every agent keeps an append-only decision log (`logs/decisions/<agent>.jsonl`, written by the agent via `scripts/log-decision` as its last step; Stop hook rejects a run with no entry) and resource log (`logs/usage/<agent>.jsonl`, written by SubagentStop/Stop hooks via `scripts/log-usage` from the transcript). Tool trace `logs/runs/<date>/<session>.jsonl` via PostToolUse (tool name, path, exit code, never contents; gitignored, 14 days). Weekly rollup `logs/summary/<yyyy-ww>.md` by orchestrator every Monday. Each entry records its parent. Logs never contain secrets, env values, user emails or file contents; a tool-safety test checks this.

```json
{
  "ts": "2026-10-21T14:02:11Z",
  "agent": "implementer",
  "parent": "orchestrator",
  "session": "a1b2",
  "ticket": "T-007",
  "stage": "build",
  "model": "sonnet",
  "decision": "...",
  "why": "...",
  "alternatives": ["..."],
  "commit": "3f9c2e1",
  "tokens_in": 48210,
  "tokens_out": 6120,
  "cache_read": 210400,
  "cost_usd": 0.62,
  "tool_calls": 31,
  "retries": 0,
  "duration_s": 412
}
```

## 6. Cost and token budgets

Enforced by `scripts/guard-budget` before each delegation and after each run, from `.claude/budgets.json`. Cost is API-equivalent USD including discounted cache reads, so the same caps work on a subscription (D9: subscription, defaults below).

| Scope                       | Cap                 | Warn at | Stop at |
| --------------------------- | ------------------- | ------- | ------- |
| Ticket S / M / L            | $1.50 / $4 / $8     | 70%     | 100%    |
| One subagent run            | $2 or 40 turns      | 70%     | 100%    |
| Consult question            | 30k tokens          | —       | 100%    |
| Headless PR review          | $0.75, max 10 turns | —       | 100%    |
| Curator run, one transition | $10                 | 70%     | 100%    |
| All agents, per day         | $15                 | 70%     | 100%    |
| All agents, per week        | $60                 | 70%     | 100%    |

| Process                                 | Max        | Then                   |
| --------------------------------------- | ---------- | ---------------------- |
| Same stage on same ticket               | 2 attempts | Stop, report, ask      |
| CI fix loop in one implementer run      | 3          | Stop, report, ask      |
| Reviewer changes-requested rounds       | 2          | Human decides          |
| Curator re-search for a failed resource | 1          | Drop resource, note it |
| Web fetches per curator topic           | 10         | Move to next topic     |
| Headless workflow retries in Actions    | 0          | Fail and comment       |

- **Warn (70%) or forecast:** one-line warning in session and `docs/status.md`, then continue.
- **Stop (100%):** halt; write a budget report in the ticket (spend by agent/stage, what's left, forecast, options: raise cap, split ticket, downgrade model, drop scope). Nothing resumes until the human answers.
- **Unusual spend:** any single run above 3× the median for its stage is flagged.
- **Context efficiency:** CLAUDE.md <150 lines, not reordered (prompt caching). Spec read by section. `docs/status.md` read first. Subagents get ticket path + spec IDs, use Grep/Glob, read line ranges, Explore on haiku. Permissions deny reading node_modules/, .next/, lockfiles, logs/runs/, test-results/, generated migrations. Commands print failures only (Vitest dot, Playwright line, hook output ≤50 lines). One ticket per session; clear context between tickets; no "while I'm here" changes.

## 7. Hooks, permissions, CI

CLAUDE.md is guidance the model can ignore; hooks, permissions, branch protection and CI are enforced.

**Permissions (`.claude/settings.json`)**

- Deny: read/edit `.env*` and `secrets/`; read node_modules/, .next/, lockfiles, logs/runs/, test-results/; `git push` to main; `git push --force`; `rm -rf`; `vercel --prod` and any production promote; `drizzle-kit push` against a non-local DB.
- Allow without asking: pnpm scripts above, git status/diff/log/add/commit/checkout -b/worktree, `scripts/log-*`, read-only Vercel and GitHub MCP calls.
- Ask: anything else, including installing a dependency or raising a budget.

**Hooks** (read tool call JSON on stdin; blocking hooks write reason to stderr, exit 2; check hooks reference for exact payload fields)

| Event        | Matcher     | Script          | Effect                                                                                         |
| ------------ | ----------- | --------------- | ---------------------------------------------------------------------------------------------- |
| PreToolUse   | Edit, Write | guard-paths.sh  | Exit 2 on `.env*`, `.github/`, `.claude/`, and `content/` unless branch starts with `content-` |
| PreToolUse   | Bash        | guard-bash.sh   | Exit 2 on push to main, force push, `--prod`, destructive DB commands                          |
| PreToolUse   | Task        | guard-budget.sh | Exit 2 if ticket/day/week at cap; warn at 70%                                                  |
| PostToolUse  | Edit, Write | post-edit.sh    | ESLint + Prettier on changed file; on `content/` file run content:validate                     |
| PostToolUse  | any         | trace.sh        | Append tool name, path, exit code to tool trace                                                |
| SubagentStop | —           | log-usage.sh    | Append token use and cost to resource log and ticket                                           |
| Stop         | —           | verify.sh       | Run `pnpm verify`, log usage, require decision-log entry; on failure return errors             |

**Branch protection on main:** require PR, 1 human approval, passing `ci` checks, linear history, no bypass for admins or bots.

**GitHub Actions:** `ci.yml` (every PR: install, typecheck, lint, unit, integration with Postgres service, data, tool-safety, security, then E2E + smoke against Vercel preview); `claude-review.yml` (PR opened/updated: reviewer headless, one comment with verdict, budget/turn capped, advisory); `smoke-prod.yml` (after prod promote: @smoke suite, opens issue on failure); `security-weekly.yml` (audit, gitleaks history, Semgrep full); `link-check.yml` (weekly, backup to Vercel Cron; opens issue of dead links for curator). Anthropic API key lives only in Actions secrets; the app needs no model key in v1.

## 8. Test strategy

| Type              | Covers                                                                                                                                                                                               | Tool                                                        | When                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Unit              | Graph module (delta, closure, topo sort, cycles), Zod schemas, budget-guard math, utilities                                                                                                          | Vitest                                                      | Changed files on edit; all on every PR          |
| Integration       | /api/roadmap and server actions on real Postgres with fixtures; migrations from empty; cache headers; uncurated pair 404                                                                             | Vitest + Postgres (Docker locally, service container in CI) | Every PR                                        |
| E2E acceptance    | One spec per flow (F1–F10), trace/video/screenshots                                                                                                                                                  | Playwright                                                  | Per ticket at Gate 3; every PR                  |
| Smoke             | `@smoke`: home loads, launch roadmap renders, topic panel opens, form submits, /api/health 200                                                                                                       | Playwright                                                  | Each preview and after each prod promote        |
| Security          | Dependency audit, secret scan, static analysis, headers/CSP, input validation + Turnstile on every form, rate limits, no data leaks (only approved resources served, no API returns an email)        | pnpm audit, gitleaks, Semgrep, Vitest, Playwright           | Every PR; full weekly                           |
| Data              | Content schema, referential integrity, acyclic edges, topic IDs unchanged vs production, seed idempotent, migrations reversible, link checker marks dead correctly                                   | content:validate, Vitest                                    | PRs touching content/, db/, scripts/            |
| Tool/agent safety | Each hook blocks what it should (fixture JSON), deny list holds, agents cannot set approved, budget guard warns at 70% and stops at 100%, every run writes both logs, logs contain no secrets/emails | Vitest running hook and log scripts                         | PRs touching .claude/ or scripts/; at bootstrap |

Test-writer owns unit/integration/E2E/smoke per ticket; security/data/tool-safety suites are set up in Sprint 0 and extended only with human approval. Any agent may add a test; an existing test may be weakened or deleted only with a human-approved ticket.

## 9. Work lifecycle and human gates

Code tickets: planner → (architect, if schema/API change) → implementer → test-writer → reviewer → Gate 3 → merge. Content enters at CI from the curation row. Reviewer `changes requested` or UI rejection returns the ticket to the implementer. Tickets without schema/API changes skip the architect and Gate 2.

| Gate        | Human checks                                                                                       | Orchestrator meanwhile              |
| ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1: tickets  | Each ticket maps to a spec ID, is v1-only, has testable acceptance and a budget                    | Nothing; no build starts            |
| 2: design   | Schema, API contract, any new dependency's ADR                                                     | Other approved tickets may continue |
| 3: UI check | Feature works in the browser (Playwright run of the worktree)                                      | Picks next ready ticket             |
| 4: merge    | Diff, reviewer verdict, green CI, Findings, spend vs budget; for content, every topic and resource | Picks next ready ticket             |
| 5: release  | `/ship-check` output, smoke results on preview                                                     | Nothing; agents never promote       |

**Gate 3 flow:** (1) orchestrator runs `pnpm uicheck <ticket>`: starts the worktree app on its own port with a seeded local DB (or uses the Vercel preview), runs the ticket's Playwright acceptance spec with trace/video/screenshots; (2) prints short summary and report path under `test-results/<ticket>/`; (3) human can rerun with `pnpm e2e:ui <ticket>`; (4) human writes `approve` or what is wrong in the ticket's UI check section. Rejections don't count toward the retry cap but their cost counts toward the ticket budget.

## 10. Curation pipeline

Curator finds and checks real sources; nothing reaches users until a human merges. Runs on demand via `/curate <transition>` (D4).

1. Trigger: a new transition picked by request volume, a `resource_suggestions` row, or a dead link.
2. Draft the tree on branch `content-<transition>`: topics, areas, prerequisite edges, requires/covers, each with a one-line reason in the PR description.
3. Find sources: 3–5 resources per topic, favouring official docs, established courses, well-known video series. Record url, type, is_free, source_note. **Never write lesson text or summaries.**
4. Verify: `scripts/verify-urls` fetches each URL, confirms 2xx and matching title, drops failures.
5. Validate: `content:validate` in post-edit hook and CI.
6. Approve: human reviews, edits, merges. A merge workflow flips resources `proposed` → `approved`; agents never do this.
7. Maintain: daily link check marks dead links `dead` and opens a replacement task.

Launch content: run `/curate full-stack-to-ml-engineer` in Sprint 1. Curation is the longest task in v1.

## 11. v1 backlog (Sprints 0–3, ~10 working days)

The planner turns these seed tickets into files; the human approves the list before Sprint 1.

| Ticket                                                                               | Sprint | Spec                  | Size | Depends on   | Agent                               |
| ------------------------------------------------------------------------------------ | ------ | --------------------- | ---- | ------------ | ----------------------------------- |
| T-001 Scaffold pnpm workspace, Next.js, Tailwind, shadcn, ESLint, Prettier           | 0      | —                     | S    | —            | implementer                         |
| T-002 .claude/ agents, commands, hooks, settings; CLAUDE.md; docs/status.md          | 0      | Multi-agent framework | M    | T-001        | orchestrator                        |
| T-020 Budgets and logs: budgets.json, guard-budget, log-usage, log-decision, /budget | 0      | Cost, Agent logs      | M    | T-002        | orchestrator                        |
| T-021 Consult commands: /ask, /status, /log (read-only)                              | 0      | Consult mode          | S    | T-020        | orchestrator                        |
| T-022 Tool-safety, security and data test harness; Postgres for integration tests    | 0      | Test strategy         | M    | T-001, T-002 | test-writer                         |
| T-003 CI workflows, branch protection, Vercel project, preview deploys               | 0      | —                     | S    | T-022        | implementer                         |
| T-004 Drizzle schema, migrations, Postgres provisioned                               | 1      | Data model            | S    | T-001        | architect → implementer             |
| T-005 Content Zod schemas, content:validate, content:seed                            | 1      | F8                    | M    | T-004        | implementer + test-writer           |
| T-006 packages/graph: delta, closure, topo sort, cycle check                         | 1      | F2                    | M    | T-001        | test-writer first, then implementer |
| T-007 GET /api/roadmap with edge caching, /api/health                                | 1      | F2, F6                | M    | T-005, T-006 | implementer                         |
| T-023 pnpm uicheck and e2e:ui for Gate 3                                             | 1      | Gate 3                | S    | T-007        | implementer                         |
| T-008 Launch content first pass via /curate                                          | 1      | Launch content        | L    | T-005        | curator (human approves)            |
| T-009 Landing + role picker                                                          | 1      | F1                    | S    | T-007        | implementer                         |
| T-010 Graph view: React Flow nodes, ELK worker, expand/collapse                      | 2      | F3, F5                | L    | T-007        | implementer                         |
| T-011 Topic panel                                                                    | 2      | F4                    | S    | T-010        | implementer                         |
| T-012 List view fallback + keyboard access                                           | 2      | F10                   | M    | T-007        | implementer                         |
| T-013 Share link + copy button                                                       | 2      | F6                    | S    | T-010        | implementer                         |
| T-014 Request, notify-me, suggest forms with Turnstile                               | 2      | F7                    | M    | T-004        | implementer                         |
| T-015 Browse roadmaps catalog                                                        | 2      | F9                    | S    | T-004        | implementer                         |
| T-016 PostHog events + Sentry                                                        | 2      | Success signals       | S    | T-009        | implementer                         |
| T-017 Link-check cron route + approval workflow                                      | 2      | F8                    | S    | T-005        | implementer                         |
| T-018 Full E2E and smoke suites, perf check (~1 s graph), security sweep             | 3      | NFRs, Test strategy   | M    | T-010–T-016  | test-writer                         |
| T-019 Launch checklist: domain, meta tags, OG image, robots, prod promote            | 3      | —                     | S    | T-018        | human                               |

Anything not on this list goes to `docs/backlog.md` under Later.

## 12. First Claude Code session

Ends at the first human gate with the framework in place and no feature code: ask D1, D4, D9 first; write ADR-0001..0003; T-001; docs scaffolding; CLAUDE.md (<150 lines); 7 subagent files; T-020 (budgets, guard and log scripts, show a warning and a hard stop on a dummy ticket); slash commands `/plan /build /review /curate /uicheck /ship-check /ask /status /budget /log`; hook scripts + settings.json (T-022 tests prove each guard refuses what it should); T-003 CI workflows and exact branch-protection and secret settings for the human; connect MCP servers (GitHub, Vercel, DB read-only); `/plan` to expand tickets with budgets; report Sprint 0 spend; **stop at Gate 1**.

Daily loop after that: `/plan` → `/build` up to 2 in parallel → reviewer per PR → Gate 3 → human merges → `/ship-check` before any production promote.

## 13. Later versions and open decisions

Keep two seams from day one: **topic IDs never change once published**, and **`packages/graph` stays free of UI and database code**.

| Version | Adds                                                                                                                                            | Lands on                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| v2      | Auth, Stripe, per-user learner state (JSON per topic), gap detector, LLM tutor via Claude API with structured output, Langfuse traces, eval set | Topics become skill-graph nodes with reviewed node packs; same graph module orders the gap-only path; React Flow nodes gain Known/Bridge/New |
| v3      | Re-tests, spaced review (FSRS), diagrams, goal from JD or repo                                                                                  | Vercel Cron for review scheduling; learner state history; embeddings only for JD→topic matching                                              |
| v4      | Open topics, foundation layer, in-browser runner (Pyodide or sql.js), teams                                                                     | Curation scales to new domains; ingestion/retrieval arrive; multi-tenant columns                                                             |

| ID  | Decision                                      | Status                                     |
| --- | --------------------------------------------- | ------------------------------------------ |
| D1  | Neon or Supabase                              | **Neon** (ADR-0001)                        |
| D2  | Graph view default, or list first on phones   | open                                       |
| D3  | Second curated transition (by request volume) | open                                       |
| D4  | Curator on demand or scheduled                | **On demand** (ADR-0002)                   |
| D5  | Product name                                  | open                                       |
| D6  | v2 auth: Auth.js or Clerk                     | open                                       |
| D7  | v2 built-in tutor or external courses         | open                                       |
| D8  | v2 first assessed track and Pro price         | open                                       |
| D9  | Billing mode and budget numbers               | **Subscription, spec defaults** (ADR-0003) |
| D10 | Split FE/BE implementers for L tickets        | open (default: no)                         |
