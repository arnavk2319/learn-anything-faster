# DESIGN.md — Trailhead theme for [App name]

Read this before building or changing any UI. It is the source of truth for colour, type, spacing, logo, motion, states and responsive behaviour. Tokens live in `app/globals.css` (canonical copy: `design/theme.css`). Wireframes are in `design/wireframes/` (v1 and v2, see its README) and on the live canvas. Read them for layout, copy, sample data and interaction logic. When this file and a wireframe disagree, this file wins; flag the conflict in the PR.

**Hard rules**

1. Never hardcode a hex value, font name, radius or duration in a component. Use the Tailwind utilities generated from the tokens (`bg-primary`, `text-muted-foreground`, `bg-highlight`, `rounded-pill`, `font-display`, `duration-200 ease-trail`).
2. Blaze yellow (`--highlight`) is never text and never the only signal on white. It always sits behind Pine text or is outlined in Pine.
3. One primary (Pine) button per view.
4. Light theme ships first. Dark tokens exist but are not designed or tested for v1.

---

## 1. Concept

Every roadmap is a marked trail from the role you have to the role you want.

| Metaphor               | In the UI                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| The trail              | The route: dashed Trail-green line on the landing, prerequisite edges on the roadmap |
| Blaze marker           | Where you are: the selected topic, the role values in the role sentence, the logo    |
| Ground already covered | Topics your current role covers: Covered tint, filled green station dot              |
| Stops on the trail     | Topic areas (lanes) and topics (pill-shaped stations)                                |

Principles

- **One bold thing per screen.** Landing: the role sentence. Browse: the live row. Roadmap: the selected topic and its highlighted edges. Everything else stays quiet.
- **Structure carries meaning.** No decorative borders, eyebrows, badges or numbering unless they encode something (e.g. prerequisite order).
- **Flat surfaces.** No gradients (the trail dash pattern is the only exception), no drop shadows except on popovers and sheets.

---

## 2. Colour

### Palette

| Name       | Hex       | Token(s)                             | Use                                                                           |
| ---------- | --------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| Pine       | `#1D3B2A` | `--foreground`, `--primary`          | Primary text, headings, primary buttons, logo outline, selected-node border   |
| Moss       | `#4F6556` | `--muted-foreground`                 | Secondary text, captions, metadata, table headers                             |
| Sage       | `#E9EFE7` | `--background`                       | Page background                                                               |
| Paper      | `#FFFFFF` | `--card`, `--popover`, `--secondary` | Panels, tables, roadmap canvas, inputs, secondary buttons                     |
| Lichen     | `#CBD6CC` | `--border`                           | Dividers, row lines, panel separators                                         |
| Bark       | `#B9C7BD` | —                                    | Resting outline on pills and chips (decorative only)                          |
| Stone      | `#788B7C` | `--input`                            | Borders on inputs, selects, checkboxes (3:1 required)                         |
| Trail      | `#1F6F50` | `--route`, `--ring`, `--known-ring`  | Route lines, highlighted edges, links, focus ring, "Live" status, covered dot |
| Trail dark | `#16543C` | `--route-hover`                      | Link and route hover                                                          |
| Blaze      | `#F2C14E` | `--highlight`                        | Selection, role sentence values, logo mark, text selection                    |
| Covered    | `#DCEBDF` | `--known`, `--accent`                | Background of covered topics and the covered lane, success confirmations      |
| Lane       | `#F3F6F1` | `--muted`                            | Area lanes on the canvas, open accordion rows                                 |
| Edge       | `#AFC0B3` | `--edge`                             | Resting prerequisite edges                                                    |
| Canvas dot | `#D3DDD2` | `--canvas-dot`                       | Dot grid on the roadmap canvas                                                |
| Danger     | `#A8321E` | `--destructive`                      | Errors only                                                                   |
| Sand       | `#F3EDD7` | `--bridge`                           | v2 only: Bridge topics (partly known) on the knowledge map                    |
| Sand edge  | `#8A6D1F` | `--bridge-ring`                      | v2 only: Bridge topic border                                                  |

### Contrast (WCAG 2.1, measured)

| Pair                  | Ratio         | Allowed for                                                    |
| --------------------- | ------------- | -------------------------------------------------------------- |
| Pine on Paper         | 12.3:1        | All text                                                       |
| Pine on Sage          | 10.5:1        | All text                                                       |
| Pine on Blaze         | 7.3:1         | All text                                                       |
| Pine on Covered       | 9.9:1         | All text                                                       |
| Moss on Paper         | 6.3:1         | All text                                                       |
| Moss on Sage          | 5.4:1         | All text                                                       |
| Trail on Paper        | 6.1:1         | All text, links                                                |
| Trail on Sage         | 5.2:1         | All text, links                                                |
| Trail on Covered      | 4.9:1         | Text ≥ 14px                                                    |
| Paper on Pine         | 12.3:1        | Button labels                                                  |
| Danger on Paper       | 6.7:1         | Error text                                                     |
| Stone on Paper / Sage | 3.6:1 / 3.1:1 | Control borders (meets 3:1 non-text)                           |
| Bark on Paper         | 1.75:1        | Decorative outlines only, never the only boundary of an input  |
| Blaze on Paper        | 1.7:1         | Never text; always pair with a Pine border or Pine text on top |

### Colour rules

- Text is Pine or Moss. Links are Trail. Nothing else is text colour except Danger for errors and Trail for "Live".
- Selected = Blaze fill + Pine border + Pine text. Do not use Trail or Pine fill for selection.
- Covered = Covered fill + Trail border + filled Trail dot.
- Status words: "Live" Trail, "Coming soon" Moss. No coloured status pills in v1.
- Do not introduce new hues. If something needs a colour that isn't here, ask.

---

### v2 knowledge-map states

| State                | Fill    | Border            | Dot / marker       |
| -------------------- | ------- | ----------------- | ------------------ |
| Known                | Covered | 1.5px Trail       | Filled Trail dot   |
| Bridge               | Sand    | 1.5px Sand edge   | Ring in Sand edge  |
| New                  | Paper   | 1.5px dashed Bark | Empty ring in Moss |
| Selected (any state) | Blaze   | 1.5px Pine        | Unchanged          |

Code blocks (v2 tutor): Pine background, Sage text, IBM Plex Mono 13–14px, radius 8. Learner messages: Covered fill, Pine text. Tutor messages: Paper with a Lichen border.

## 3. Typography

### Families

| Role                                                                          | Family           | Weights       | Loading                                        |
| ----------------------------------------------------------------------------- | ---------------- | ------------- | ---------------------------------------------- |
| Display: headlines, role sentence, area names, topic title in panel, wordmark | Familjen Grotesk | 600, 700      | `next/font/google`, variable `--font-familjen` |
| UI and body: everything else                                                  | Hanken Grotesk   | 400, 500, 600 | `next/font/google`, variable `--font-hanken`   |

```ts
// app/fonts.ts
import { Familjen_Grotesk, Hanken_Grotesk } from "next/font/google";
export const familjen = Familjen_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-familjen",
  display: "swap",
});
export const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-hanken",
  display: "swap",
});
// app/layout.tsx: <html className={`${familjen.variable} ${hanken.variable}`}>
```

No monospace in the product UI (code samples inside resources are the only exception).

### Scale

| Token     | Size / line height | Family, weight | Letter spacing | Where                                           |
| --------- | ------------------ | -------------- | -------------- | ----------------------------------------------- |
| `display` | 56 / 1.18          | Familjen 600   | -1.2px         | Landing role sentence                           |
| `h1`      | 44 / 1.15          | Familjen 600   | -0.8px         | Page titles (Roadmaps)                          |
| `h2`      | 30 / 1.2           | Familjen 600   | -0.5px         | Roadmap header role sentence                    |
| `h3`      | 28 / 1.15          | Familjen 600   | -0.4px         | Topic title in panel, empty-state title         |
| `h4`      | 17–18 / 1.3        | Familjen 600   | 0              | Area names, section heads ("Popular moves")     |
| `body-lg` | 17 / 1.55          | Hanken 400     | 0              | Page intro lines                                |
| `body`    | 15–16 / 1.55       | Hanken 400     | 0              | Default text                                    |
| `ui`      | 14–15 / 1.4        | Hanken 500     | 0              | Buttons, nav, node labels, inputs               |
| `small`   | 13 / 1.45          | Hanken 400     | 0              | Metadata, captions, table headers               |
| `micro`   | 12 / 1.4           | Hanken 400     | 0              | Canvas hints only. Minimum size in the product. |

Mobile (< 768px): `display` 34/1.2, `h1` 32/1.2, `h2` 22/1.25, `h3` 22/1.2. Use `clamp()` between breakpoints.

### Type rules

- Sentence case everywhere. No all caps, no Title Case, no letter-spaced labels above headings.
- Don't emphasise a single word in a headline with colour, italic or bold. The only highlighted words are the role values in the role sentence, and they are highlighted because they are controls.
- Line length ≤ 75 characters for body text (`max-w-prose` or ~640px).
- Numbers in tables use `font-variant-numeric: tabular-nums`.

---

## 4. Spacing, layout and shape

- **Base unit 4px.** Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64.
- **Page width:** content max 1280px, centred. Page padding: 64px ≥ 1280, 32px 768–1279, 20px < 768.
- **Header:** 72px tall on marketing pages (Landing, Browse), 64px on the roadmap; no background fill, it sits on Sage. Signed-in app screens (v2: Dashboard, Path, Tutor, Mastery) use a 64px Paper header with a Lichen bottom border and the nav (Dashboard, Path, Map).
- **Vertical rhythm:** 56–64px between hero and next section on Landing; 28px between title block and table on Browse; 14–16px between toolbar and canvas on Roadmap.
- **Alignment:** left aligned everywhere. Centre only inside small empty states if they are narrower than 520px; prefer left.

| Shape                  | Radius                 | Elements                                                |
| ---------------------- | ---------------------- | ------------------------------------------------------- |
| Control                | 10px (`rounded-md`)    | Buttons, inputs, selects, segmented control, zoom group |
| Segment inside control | 7px                    | Active segment in segmented control                     |
| Panel                  | 16px (`rounded-lg`)    | Roadmap canvas, side panel, Browse table                |
| Lane                   | 20px (`rounded-lane`)  | Area groups on the canvas                               |
| Pill                   | 999px (`rounded-pill`) | Topic nodes, chips (Needs first / Unlocks)              |
| Mark                   | 4px                    | Logo blaze                                              |
| Page                   | 0                      | Page edges, header                                      |

**Borders:** 1px Lichen for dividers and panel separators; 1.5px for topic nodes and lanes; 1px Stone on form controls; 2px Pine on the logo mark. **Elevation:** none on panels. `shadow-md` only on popovers, select menus, sheets and toasts.

---

## 5. Logo

- **Mark:** a trail blaze. Rounded rectangle 14 × 20px, radius 4px, Blaze fill, 2px Pine inside border. Upright, never rotated.
- **Wordmark:** product name in Familjen Grotesk 700, 22px, letter spacing -0.3px, Pine. Mark sits left of the wordmark, 10px gap, mark baseline 3px below the text baseline.
- **Clear space:** at least the mark's width (14px) on all sides.
- **Minimum size:** mark 10 × 14px; wordmark 16px.
- **On dark backgrounds** (Pine): mark keeps Blaze fill with a 2px Paper border; wordmark in Paper.
- **Favicon / app icon:** the mark alone, centred on Sage, with 20% padding. Export 16, 32, 180, 192, 512px and an SVG.
- **Don't:** recolour the mark, add a gradient or shadow, outline the wordmark, place the mark on Blaze, stretch it, or use the mark as a bullet or decoration elsewhere.
- Product name is a placeholder: render it from one constant (`APP_NAME`) so it changes in one place.

---

## 6. Backgrounds

| Surface                        | Background                                                                  |
| ------------------------------ | --------------------------------------------------------------------------- |
| Page                           | Sage, flat                                                                  |
| Panels, tables, inputs         | Paper                                                                       |
| Roadmap canvas                 | Paper with the dot grid (`.canvas-dots`)                                    |
| Area lane                      | Lane (`#F3F6F1`), no border                                                 |
| Covered lane                   | Covered fill, 1.5px Trail border                                            |
| Open accordion row (list view) | Lane                                                                        |
| Empty / unmapped states        | Paper, with a dashed Bark trail line (`.trail-line[data-state="unmapped"]`) |

No images, gradients, textures or illustrations in v1.

---

## 7. Components (shadcn/ui mapping)

Install: `button`, `select`, `toggle-group`, `input`, `table`, `sheet`, `drawer`, `tooltip`, `sonner` (toasts), `scroll-area`. Style them only through the tokens; extend with variants, don't fork.

| Component                               | shadcn base                                              | Spec                                                                                                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary button                          | `Button` default                                         | Pine fill, Paper text, 600, height 52 (hero) / 44 (default) / 40 (table), padding 22–26px, radius 10                                                                                                          |
| Secondary button                        | `Button variant="outline"`                               | Paper fill, 1px Lichen border, Pine text 500                                                                                                                                                                  |
| Ghost button                            | `Button variant="ghost"`                                 | Transparent, Pine text; hover Lane                                                                                                                                                                            |
| Link button                             | `Button variant="link"`                                  | Trail text, underline on hover only                                                                                                                                                                           |
| Role sentence select                    | `Select` with custom trigger                             | Trigger is the role text itself in the display style, Blaze background, radius 8 (landing) / 6 (header), padding 0 12px, caret ▾ in Pine. Menu: Paper, `shadow-md`, items `ui` size, selected item Blaze fill |
| Segmented control (Map / List, filters) | `ToggleGroup type="single"`                              | Paper container, 1px Lichen border, padding 4, gap 4; item height 34–36, radius 7; active item Pine fill + Paper text                                                                                         |
| Text input                              | `Input`                                                  | Height 44–52, Paper fill, 1px Stone border, radius 10, placeholder Moss                                                                                                                                       |
| Browse table                            | `Table`                                                  | Paper, radius 16, header row `small` Moss, rows 68px, 1px Sage divider, live row has a 4px Trail left border (radius 0 on that edge)                                                                          |
| Topic node                              | custom React Flow node                                   | Pill 184 × 40, 1.5px Bark border, Paper fill; station dot 14px ring 3px Trail on the left; label `ui` 14px 500, no wrap                                                                                       |
| Area lane                               | React Flow group node                                    | Lane fill, radius 20, header 44–48px with name (`h4`), count (`small` Moss) and caret; collapsible                                                                                                            |
| Edge                                    | React Flow custom edge                                   | Bezier between columns, straight within a column, 2px Edge colour, round caps, small chevron at target                                                                                                        |
| Chip (Needs first / Unlocks)            | `Button` small                                           | Pill, height 30, 1px Bark border, `small`; covered chips Trail text and border with "(you know this)"                                                                                                         |
| Side panel                              | `aside` (desktop) / `Sheet` (tablet) / `Drawer` (mobile) | Paper, radius 16, padding 24                                                                                                                                                                                  |
| Resource row                            | link                                                     | Title 15/600, meta `small` Moss ("YouTube, video series, free"), external-link icon 16px Trail; rows separated by 1px Sage                                                                                    |
| Toast                                   | `sonner`                                                 | Paper, `shadow-md`, Pine text; success with a Trail dot. Copy in past tense: "Link copied"                                                                                                                    |
| Empty / unmapped state                  | custom                                                   | Dashed Bark trail line, `h3` title "X to Y isn't mapped yet", one-line body, email input + "Request this move"                                                                                                |

Icons: Lucide (ships with shadcn), 16px in UI, 20px in nav, stroke 1.75, colour inherits. Only where they add meaning (external link, zoom, caret, close).

---

## 8. Interaction states

Apply these consistently. Transitions use `--dur-fast` (120ms) for colour and border, `--ease-trail`.

| Element             | Default                                | Hover                                                        | Focus-visible              | Pressed    | Selected / active                                                                                | Disabled                                                     |
| ------------------- | -------------------------------------- | ------------------------------------------------------------ | -------------------------- | ---------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Primary button      | Pine fill                              | Fill `--primary-hover` (`bg-primary-hover`)                  | 3px Trail ring, 2px offset | Scale 0.98 | —                                                                                                | Avoid; if unavoidable 40% opacity + `disabledReason` tooltip |
| Secondary button    | Paper, Lichen border                   | Border Stone, fill Lane                                      | Trail ring                 | Scale 0.98 | —                                                                                                | as above                                                     |
| Link                | Trail                                  | Trail dark + underline                                       | Trail ring                 | —          | `aria-current` page: Pine 600 in nav                                                             | —                                                            |
| Topic node          | Paper, Bark border                     | Border Pine, cursor pointer, its edges darken to Pine at 60% | Trail ring around the pill | Scale 0.98 | Blaze fill, Pine 1.5px border, dot Pine ring; its incoming and outgoing edges become 3.5px Trail | —                                                            |
| Covered node        | Covered fill, Trail border, filled dot | Border Pine                                                  | Trail ring                 | —          | Blaze fill (dot stays filled Trail)                                                              | —                                                            |
| Area lane header    | Transparent                            | Fill Paper at 60%                                            | Trail ring                 | —          | Collapsed shows ▶, expanded ▼                                                                    | —                                                            |
| Table row (Browse)  | Paper                                  | Fill `#F7F9F6`                                               | Row focus Trail ring inset | —          | Live row: 4px Trail left border                                                                  | —                                                            |
| Chip                | Paper, Bark border                     | Border Pine                                                  | Trail ring                 | —          | —                                                                                                | —                                                            |
| Role select trigger | Blaze background                       | Blaze + 1.5px Pine underline                                 | Trail ring                 | —          | Open: menu visible                                                                               | —                                                            |
| Segmented item      | Transparent, Pine text                 | Fill Lane                                                    | Trail ring                 | —          | Pine fill, Paper text                                                                            | —                                                            |
| Input               | Stone border                           | Border Pine                                                  | Trail ring, border Trail   | —          | —                                                                                                | —                                                            |
| Invalid input       | Danger border                          | —                                                            | Danger ring                | —          | Error text `small` Danger below: "Enter an email address"                                        | —                                                            |

Highlight rules

- At most one selected topic at a time. Its connected edges highlight; nothing else does.
- Text selection uses Blaze background with Pine text (set in `theme.css`).
- Don't highlight on hover with Blaze. Blaze means "chosen", not "pointed at".

Click and keyboard behaviour (roadmap)

- Click a topic: select it, open or update the panel, highlight its edges. Click empty canvas: keep selection (don't clear).
- Click a chip in "Needs first" or "Unlocks": select that topic and pan it into view (animated, see Motion). If it's covered, turn on "Show what you already know" first.
- Click a lane header: collapse or expand; edges re-route to the lane edge.
- Keyboard: Tab enters the canvas on the selected node; arrow keys move to the nearest connected node in that direction; Enter opens the panel; Escape returns focus to the toolbar. Zoom: `+` / `-`, fit: `0`.
- Drag on empty canvas pans; pinch or ctrl+wheel zooms (0.4–1.6). Plain wheel scrolls the page, not the canvas.

---

## 9. Motion

| Token          | Value                          | Use                                                                |
| -------------- | ------------------------------ | ------------------------------------------------------------------ |
| `--dur-fast`   | 120ms                          | Colour, border, background on hover and focus                      |
| `--dur-base`   | 200ms                          | Panel content swap, lane collapse, segmented control, select menus |
| `--dur-slow`   | 320ms                          | Graph re-layout after a role change, pan-to-node                   |
| `--ease-trail` | cubic-bezier(0.2, 0.8, 0.2, 1) | Everything                                                         |

- **The one orchestrated moment:** when a roadmap first renders or the roles change, nodes move from their old positions to the new layout (or fade in from 0 → 1 opacity with a 4px horizontal shift for new nodes) over 320ms, staggered 12ms per column. Edges fade in after nodes settle. Nothing else animates on load.
- Panel content cross-fades (opacity only) in 200ms when the selection changes.
- Lane collapse animates height and node opacity in 200ms.
- Pressed state: `scale(0.98)` for 120ms.
- No scroll-triggered entrances, no parallax, no looping animation, no hover lift on cards.
- `prefers-reduced-motion: reduce`: disable movement (positions jump), keep opacity changes ≤ 120ms. Already handled globally in `theme.css`; React Flow and Framer Motion code must also check `useReducedMotion()`.

---

## 10. Responsiveness

Breakpoints (Tailwind defaults): `sm` 640, `md` 768, `lg` 1024, `xl` 1280.

| Page    | ≥ 1280                    | 1024–1279                                                                | 768–1023                                                  | < 768                                                                                                                                                                          |
| ------- | ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing | As wireframe              | Role sentence 48px                                                       | Role sentence 40px; route stops show names, counts hidden | Role sentence 34px, selects wrap onto their own lines; route line turns vertical (stops stacked, line on the left); popular moves become a list                                |
| Browse  | 5-column table            | Same, "Size" column narrows                                              | Drop "Size" column                                        | Each row becomes a stacked block: To (h4), From (small), status, full-width action button; request form stacks                                                                 |
| Roadmap | Canvas 836px + side panel | Canvas fills width; panel is a right `Sheet` (400px) opened on selection | Same as 1024                                              | Default to List view; Map view available full-screen; panel is a bottom `Drawer` (snap points 40% and 90%); header selects stack; toolbar becomes a single row of icon buttons |

- Minimum touch target 44 × 44px (nodes are 40px tall: add 4px invisible hit area on touch).
- Never horizontal-scroll the page. Only the canvas pans.
- Test at 375, 768, 1024, 1280 and 1440px.

---

## 11. Writing

- Sentence case, plain verbs, no exclamation marks, no "please", no "simply".
- Roles are joined with "to": "Full-stack engineer to ML engineer". No arrows in copy.
- No middle-dot metadata strings ("A · B · C"). Use commas or separate lines.
- Don't append "→" to links or buttons.
- Buttons say exactly what happens: "Show my roadmap", "Request this move", "Copy link", "Notify me". Confirmation matches: "Requested", "Link copied", "You'll be notified".
- Vocabulary: **roadmap** (the whole thing), **move** (a role-to-role transition), **area** (a group of topics), **topic** (a node), **already know / covered** (topics skipped because of the current role), **resource** (a linked course, video, doc or article).
- Empty and error states say what happened and what to do: "Full-stack engineer to AI engineer isn't mapped yet. Request this move and we'll email you when it's ready."

---

## 12. Page structure: shell, feature pages, child components

```
app/
  layout.tsx                 Shell: fonts, <html> classes, Toaster, analytics
  (marketing)/layout.tsx     Header 72px: Logo, nav (Browse roadmaps, See an example)
  (marketing)/page.tsx       Landing        → v1 · 1
  (marketing)/roadmaps/page.tsx  Browse     → v1 · 2
  roadmap/[from]/[to]/page.tsx   Roadmap    → v1 · 3 (header 64px)
components/
  brand/Logo.tsx             Mark + wordmark (APP_NAME constant)
  role/RoleSentence.tsx      Display-size sentence with two RoleSelects
  role/RoleSelect.tsx        shadcn Select with highlight trigger (size: hero | header)
  route/RouteLine.tsx        Landing trail with stops; vertical on mobile
  browse/MovesTable.tsx      Table + mobile stacked rows
  browse/RequestMove.tsx     Inline request form (validation, success state)
  roadmap/RoadmapCanvas.tsx  React Flow wrapper: dots background, toolbar, pan/zoom
  roadmap/TopicNode.tsx      Pill node (states: default, hover, selected, covered)
  roadmap/AreaLane.tsx       Group node, collapsible
  roadmap/PrereqEdge.tsx     Custom edge (resting / highlighted)
  roadmap/CanvasToolbar.tsx  Zoom group, Fit, Show what you already know
  roadmap/TopicPanel.tsx     Panel / Sheet / Drawer by breakpoint
  roadmap/ResourceList.tsx   Resource rows
  roadmap/RoadmapList.tsx    Accessible list view (accordion)
  roadmap/UnmappedState.tsx  Not-mapped empty state with request form
components/ui/               shadcn primitives, styled only via tokens
```

Rules

- **Shell (parent)** owns fonts, theme class, toasts and the header. Feature pages never re-implement the header or logo.
- **Feature pages** compose components and own data fetching and URL state (`from`, `to`, `view=map|list`, `topic`). The URL is the source of truth so links reproduce the view.
- **Child components** are presentational: props in, events out, no fetching, no hardcoded copy beyond labels, all states (loading, empty, error, selected) handled and shown in Storybook or a `/dev` page.
- Every interactive element gets visible focus, an accessible name and keyboard support.

### React Flow settings

- Layout: ELK `layered`, direction `RIGHT`, `elk.spacing.nodeNode` 12, `elk.layered.spacing.nodeNodeBetweenLayers` 52, areas as compound nodes with 48px top padding. Run in a Web Worker.
- `fitView` on first render with padding 0.08; min zoom 0.4, max 1.6.
- `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable` true, `panOnScroll={false}`, `zoomOnScroll={false}`, `zoomOnPinch` true.
- Background: use `.canvas-dots` on the wrapper rather than React Flow's `<Background>` so it matches the token.
- Hide the React Flow attribution only if your licence allows it.

---

## 13. PR checklist (UI changes)

- [ ] No hardcoded colours, fonts, radii or durations
- [ ] Blaze never used as text or without a Pine edge
- [ ] One primary button per view
- [ ] Hover, focus-visible, pressed, selected and empty states implemented
- [ ] Keyboard path works; focus ring visible
- [ ] Checked at 375, 768, 1024, 1280px
- [ ] Reduced motion respected
- [ ] Copy follows section 11
- [ ] Screenshot compared against the matching wireframe board
