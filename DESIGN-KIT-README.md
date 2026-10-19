# Trailhead design kit

Everything Claude Code needs to set up the theme, styling and v1 screens for [App name]: the design guide, shadcn/ui theme tokens, fonts, logo, the wireframes, sample roadmap data, a setup command and a UI review agent.

## Install

1. Unzip into the root of your Next.js project (files land directly in the root; nothing overwrites an existing README) (App Router, TypeScript, Tailwind v4). If the repo is empty, that's fine: the setup command creates the app.
   - If `app/globals.css`, `components.json` or `lib/` already exist, unzip into a folder first and let the setup command merge them.
2. Append `claude-md-snippet.md` to your `CLAUDE.md` (create it if needed).
3. Open Claude Code in the project and run:

```
/setup-design
```

That's it. The command reads `DESIGN.md`, sets up shadcn/ui, the theme, fonts and logo, builds the child components with all their states, then builds the v1 pages from the wireframes using the sample data. It stops before pushing anything.

To check any UI change against the guide later, ask Claude Code to "use the ui-reviewer agent on this branch".

## What's inside

| Path                                      | What it is                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN.md`                               | The design guide: concept, colour, contrast, type, spacing, logo, backgrounds, components, states, motion, responsiveness, copy, page structure, PR checklist |
| `design/theme.css`                        | Canonical theme tokens (shadcn/ui variables + Tailwind v4 `@theme`)                                                                                           |
| `app/globals.css`                         | Same file, ready to drop in                                                                                                                                   |
| `app/fonts.ts`                            | Familjen Grotesk + Hanken Grotesk via `next/font`                                                                                                             |
| `lib/brand.ts`                            | `APP_NAME` constant (the name is still a placeholder)                                                                                                         |
| `components/brand/Logo.tsx`               | Trail-blaze mark + wordmark                                                                                                                                   |
| `components.json`                         | shadcn/ui config pointing at `app/globals.css`                                                                                                                |
| `public/brand/`                           | Mark, mark on dark, favicon (SVG)                                                                                                                             |
| `design/wireframes/`                      | v1 and v2 wireframe sources, with a README mapping screens to routes                                                                                          |
| `data/seed/fullstack-to-ml-engineer.json` | Roles, areas, topics, prerequisite edges and proposed resources for the launch roadmap                                                                        |
| `.claude/commands/setup-design.md`        | The `/setup-design` command                                                                                                                                   |
| `.claude/agents/ui-reviewer.md`           | Read-only reviewer that checks UI against `DESIGN.md`                                                                                                         |
| `claude-md-snippet.md`                    | Lines to add to `CLAUDE.md`                                                                                                                                   |

## Related docs (not in the zip)

- Live wireframe canvas: https://claude.ai/artifact/JuK7iNkf8sQtAgpRbyCYBd
- Scope plan (v1–v4) and Tech Stack & Architecture are Claude Docs in the project. Export each as Markdown from the doc and save them as `docs/scope.md` and `docs/architecture.md` so agents can read them.

## Notes

- Resource links in the seed data are `null` on purpose. Real links must be found, checked and approved by a person before they ship.
- Pin package versions when the command installs them, and prefer releases that have been out for a couple of weeks.
