# Wireframes

Live, clickable canvas: https://claude.ai/artifact/JuK7iNkf8sQtAgpRbyCYBd

The `.dc.html` files are the wireframe sources. They need the canvas runtime to render, so don't try to open them directly in a browser. Read them as specs: the markup shows layout and copy, and the `<script type="text/x-dc">` block at the bottom holds the sample data and interaction logic (state, what each click does). Inline colours in them are wireframe values; in the app, use the tokens from `app/globals.css`.

All screens use the Trailhead theme. `DESIGN.md` wins over any wireframe detail.

## v1 · Roadmap builder (build now)

| File                   | Screen                         | Route                  | Key behaviour                                                                                                                                                        |
| ---------------------- | ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1/V1Landing.dc.html` | Landing + role picker          | `/`                    | Role sentence with two selects; mapped move shows "Show my roadmap", unmapped move shows email request; route line preview                                           |
| `v1/V1Browse.dc.html`  | Browse roadmaps                | `/roadmaps`            | Table of moves, All / Live / Coming soon filter, Notify me, request form                                                                                             |
| `v1/V1Roadmap.dc.html` | Live roadmap graph + resources | `/roadmap/[from]/[to]` | Role switch re-renders, Map / List toggle, collapsible areas, show covered, zoom and pan, topic panel with Needs first / Unlocks chips and resources, unmapped state |

## v2 · Skip what you know (later)

| File                     | Screen                               |
| ------------------------ | ------------------------------------ |
| `v2/Main.dc.html`        | v2 landing                           |
| `v2/HowItWorks.dc.html`  | How it works                         |
| `v2/Goal.dc.html`        | Goal setup                           |
| `v2/Diagnostic.dc.html`  | Gap detector                         |
| `v2/Map.dc.html`         | Knowledge map (Known / Bridge / New) |
| `v2/Signup.dc.html`      | Save your map (signup)               |
| `v2/Path.dc.html`        | Gap-only path                        |
| `v2/Tutor.dc.html`       | Tutor session, gap mode              |
| `v2/TutorNovice.dc.html` | Tutor session, novice mode           |
| `v2/Mastery.dc.html`     | Mastery check                        |
| `v2/Paywall.dc.html`     | Paywall                              |
| `v2/Dashboard.dc.html`   | Dashboard                            |

Don't build v2 screens until asked; they're included so components and tokens are designed with them in mind (for example the Bridge state and code blocks).

## Learn module (T-038, ADR-0015)

Standalone static HTML (no build, no canvas runtime): open the file directly in a browser. They link `../../theme.css` and
`learn.css` (shared), and use only theme tokens. Light vanilla JS only for tabs, view toggle, filters, favorites, question check
and the sim demo. Resize the window to check 375, 768 and desktop. Toggle OS "reduce motion" to see the reduced-motion states.
DESIGN.md "Learn module addendum" is the spec; these files show it.

| File                         | Route                                                | Key behaviours                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `learn/learn-landing.html`   | `/learn`                                             | Bubble grid (idle float), counts, progress ring, favorite star, 1 live + 4 coming-soon, search, filter chips, Bubbles/List toggle (table fallback)                      |
| `learn/learn-track.html`     | `/learn/system-design` (+ `/problems`, `/questions`) | Overview header with ring and Continue; tabs Concepts, Problems, Questions (all three panels switch); levels basic/intermediate/advanced, sim badge, progress, star     |
| `learn/learn-concept.html`   | `/learn/system-design/concepts/caching`              | Sim frame (LRU read path): tokens, controls, scenario select, caption, LRU state widget, inspector (desktop panel, mobile bottom sheet), text blocks, Quick check, link |
| `learn/learn-questions.html` | `/learn/system-design/questions/caching`             | Filters, set progress, mcq with Check and explanation, short-explain with model answer, rubric and self-grade                                                           |

Shared files: `learn/learn.css` (screens), `learn/learn.js` (interactions), `learn/sim.js` (demo engine: frame derived from scenario and time).
Note: opening them logs one harmless 404 for `@import "tailwindcss"` at the top of `theme.css`; it does not affect rendering.
