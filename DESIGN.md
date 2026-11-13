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
| `h2`      | 24 / 1.2           | Familjen 600   | -0.5px         | Roadmap header role sentence                    |
| `h3`      | 28 / 1.15          | Familjen 600   | -0.4px         | Topic title in panel, empty-state title         |
| `h4`      | 17–18 / 1.3        | Familjen 600   | 0              | Area names, section heads ("Popular moves")     |
| `body-lg` | 17 / 1.55          | Hanken 400     | 0              | Page intro lines                                |
| `body`    | 15–16 / 1.55       | Hanken 400     | 0              | Default text                                    |
| `ui`      | 14–15 / 1.4        | Hanken 500     | 0              | Buttons, nav, node labels, inputs               |
| `small`   | 13 / 1.45          | Hanken 400     | 0              | Metadata, captions, table headers               |
| `micro`   | 12 / 1.4           | Hanken 400     | 0              | Canvas hints only. Minimum size in the product. |

Mobile (< 768px): `display` 34/1.2, `h1` 32/1.2, `h2` 20/1.25, `h3` 22/1.2. Use `clamp()` between breakpoints.

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
| Roadmap canvas                 | Sage (same as the page) with the contour pattern (`.canvas-contour`)        |
| Area lane                      | Lane band (`--lane-band`, 62% Paper), no border, rounded `--radius-lane`    |
| Covered lane                   | Lane band, 1.5px Trail border                                               |
| Open accordion row (list view) | Lane                                                                        |
| Empty / unmapped states        | Paper, with a dashed Bark trail line (`.trail-line[data-state="unmapped"]`) |

No images, gradients, textures or illustrations in v1, with one exception: the roadmap canvas may show the
decorative contour pattern (`.canvas-contour`, inline SVG, `--contour` stroke, `aria-hidden`). It carries no meaning,
stays below 1.3:1 against its background, and must never sit behind text without a lane band or a paper node on top.

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

| Element             | Default                                | Hover                                                                                                                  | Focus-visible              | Pressed    | Selected / active                                                                                                                                          | Disabled                                                     |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Primary button      | Pine fill                              | Fill `--primary-hover` (`bg-primary-hover`)                                                                            | 3px Trail ring, 2px offset | Scale 0.98 | —                                                                                                                                                          | Avoid; if unavoidable 40% opacity + `disabledReason` tooltip |
| Secondary button    | Paper, Lichen border                   | Border Stone, fill Lane                                                                                                | Trail ring                 | Scale 0.98 | —                                                                                                                                                          | as above                                                     |
| Link                | Trail                                  | Trail dark + underline                                                                                                 | Trail ring                 | —          | `aria-current` page: Pine 600 in nav                                                                                                                       | —                                                            |
| Topic node          | Paper, Bark border                     | Border Pine, cursor pointer, its edges darken to Pine at 60%; unmet edges stay dashed Stone; hot edges are solid Trail | Trail ring around the pill | Scale 0.98 | Blaze fill, Pine 1.5px border, dot Pine ring; its incoming and outgoing edges become solid 3.5px Trail and draw from prerequisite to topic over --dur-slow | —                                                            |
| Prerequisite edge   | Dashed Stone 1.5px                     | (via node hover)                                                                                                       | n/a                        | n/a        | Solid Trail 3.5px, drawn in                                                                                                                                | n/a                                                          |
| Covered node        | Covered fill, Trail border, filled dot | Border Pine                                                                                                            | Trail ring                 | —          | Blaze fill (dot stays filled Trail)                                                                                                                        | —                                                            |
| Area lane header    | Transparent                            | Fill Paper at 60%                                                                                                      | Trail ring                 | —          | Collapsed shows ▶, expanded ▼                                                                                                                              | —                                                            |
| Table row (Browse)  | Paper                                  | Fill `#F7F9F6`                                                                                                         | Row focus Trail ring inset | —          | Live row: 4px Trail left border                                                                                                                            | —                                                            |
| Chip                | Paper, Bark border                     | Border Pine                                                                                                            | Trail ring                 | —          | —                                                                                                                                                          | —                                                            |
| Role select trigger | Blaze background                       | Blaze + 1.5px Pine underline                                                                                           | Trail ring                 | —          | Open: menu visible                                                                                                                                         | —                                                            |
| Segmented item      | Transparent, Pine text                 | Fill Lane                                                                                                              | Trail ring                 | —          | Pine fill, Paper text                                                                                                                                      | —                                                            |
| Input               | Stone border                           | Border Pine                                                                                                            | Trail ring, border Trail   | —          | —                                                                                                                                                          | —                                                            |
| Invalid input       | Danger border                          | —                                                                                                                      | Danger ring                | —          | Error text `small` Danger below: "Enter an email address"                                                                                                  | —                                                            |

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
- Edge draw-in: when a topic is selected, its connected edges draw
  along the path (stroke-dashoffset, --dur-slow, --ease-trail). Runs once per selection; no looping.
- Panel content cross-fades (opacity only) in 200ms when the selection changes.
- Lane collapse animates height and node opacity in 200ms.
- Pressed state: `scale(0.98)` for 120ms.
- No scroll-triggered entrances, no parallax, no looping animation, no hover lift on cards.
- `prefers-reduced-motion: reduce`: disable movement (positions jump), keep opacity changes ≤ 120ms. Already handled globally in `theme.css`; Draw-in is replaced by an instant solid edge; React Flow code checks the same media query via `usePrefersReducedMotion()`.

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
- Background: the `.canvas-contour` wrapper plus one `ContourLayer` child inside `<ReactFlow>`; not React Flow's `<Background>`.
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

---

## 14. Learn module addendum (T-038, ADR-0015)

Applies to `/learn` and below. Wireframes: `design/wireframes/learn/` (see its README). New tokens are in `design/theme.css`;
**syncing them into `app/globals.css` and the `@theme inline` block is T-042's job**, not T-038's. Everything here reuses sections
1 to 13; where this section is more specific for Learn, it wins. Voice, sentence case and the no-gradient rule still apply.

### 14.1 Tokens added

| Token                                                        | Value                                      | Use                                                       |
| ------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------- |
| `--sim-request`                                              | `--trail`                                  | Request token and its edge: filled pill                   |
| `--sim-response`                                             | `#2d5f8b` (dark `#7fb2e0`), 6.9:1 on Paper | Response token and edge: outlined pill                    |
| `--sim-replicate`                                            | `--sand-edge` (dark `#d9b95c`)             | Replicate, cache fill, sync: dashed outlined pill         |
| `--sim-error`                                                | `--danger` (dark `#e58a76`)                | Error token and edge: filled pill with "!"                |
| `--bubble-size` / `--bubble-size-sm`                         | 184px / 148px (< 768)                      | Track bubble diameter                                     |
| `--ring-sm` / `--ring-md` / `--ring-lg` / `--ring-thickness` | 32 / 48 / 72 / 6px                         | Progress ring: row, card, track header                    |
| `--bubble-float-dur` / `--bubble-float-dist`                 | 7s / 6px                                   | Idle float                                                |
| `--sim-hop-dur` / `--sim-pulse-dur` / `--sim-state-dur`      | 1400ms / 600ms / `--dur-base`              | Token crossing one edge at 1x / node pulse / slot reorder |

Colour is never the only signal: tokens differ by shape (filled, outlined, dashed, "!") and always carry a text label ("GET c",
"value c", "fill d", "! 503"). The legend under every sim names the four kinds. Components use these tokens, never hex values.

### 14.2 Bubbles (`/learn`)

- Ordered grid, `repeat(auto-fill, minmax(--bubble-size, 1fr))`, 32px gap (20px under 768). Live tracks first, then soon, in curated order.
- Bubble: circle, Paper (live: `--known` fill, 1.5px Trail border; soon: Lane band fill, dashed Bark border, Moss text). Title `h4` centred,
  counts `micro` ("21c · 37p · 400q", tabular), progress ring `--ring-md` below. Centred text is allowed here: it is inside a circle.
- Favorite star sits top right, 40px, Paper chip with a Lichen border. Soon bubbles are a `div` (not a link) with a "Coming soon" badge.
- Idle float: translateY 0 to -6px, 7s ease-in-out, staggered by negative delays. This is the one deliberate exception to the
  "no looping animation" rule in section 9, limited to bubbles and the sim. Hover: border Pine, no lift.
- Toolbar: search (Input), Bubbles | List (segmented), chips All, Live, Soon, Favorites, In progress (single-select, selected = Blaze, as "chosen").
- **List view** is a real `Table` (Track, Status, Concepts, Problems, Questions, Progress, Favorite), live row has the 4px Trail left border.
  It is the default for keyboard-first use and under 768px (as the roadmap list view), and the no-JS fallback. Counts columns hide under 768.
- Empty search result: Paper panel, `h4` "No tracks match", one line.

### 14.3 Tabs, rows, progress ring, favorite star

- **Tabs** (Concepts | Problems | Questions): underline tabs, height 48, 3px Trail underline on the selected one, `aria-selected`, arrow keys move,
  count in `micro` Moss. In the app these are links to real routes (the Concepts tab is the track root); the wireframe switches panels.
- **Row** (concept, problem, set): Paper list in a 16px panel, min height 68, 1px Sage dividers, hover Lane. Left: station dot 14px (filled Trail
  when done). Title 16/600 link in Pine, subline `small` Moss. Right: `sim` badge (Trail text and border), 96px progress bar, "2/5" (hidden under
  768), favorite star. Levels are `h4` headings with the count in `small` ("Basic 7 concepts"), anchors `#basic|#intermediate|#advanced`.
- **Progress ring**: conic ring, Trail value on a Border track, thickness `--ring-thickness`, centre label `micro` 600 tabular ("38%"); `sm` has no
  label. Always has `role="img"` and an `aria-label` ("38% done"). Derivation is in ADR-0015 section 6.
- **Favorite star**: 44px target, outline star Stone when off, solid Pine star on a Blaze disc when on, `aria-pressed`, label "Favorite <name>".
  Blaze here means "chosen by you". Never changes layout.
- **Continue** card: Paper panel, dot, "Continue where you left off", item name and level, primary button.

### 14.4 Question card

Paper panel, radius 16, padding 20 24, max width 760. Header row: "Q3", type badge, level badge, difficulty chip, star at the end.
**mcq**: fieldset and legend (the prompt), options as 44px+ rows with a native radio, Check button (primary 40). After Check: right option gets
Known fill and Trail border, a wrong pick gets a Danger border, the explanation reveals below (Lane panel, 4px Trail left border, Danger when wrong),
`role="status"`. **short-explain**: textarea (stays on device), "Show model answer", then model answer plus a rubric list, then "I got it" and "Not yet"
(outline). The self-grade is stored as `selfGraded`. Set progress: `h2`, 8px bar, "7 of 12 answered, 5 right". Filters: Concept, Type, Level,
Difficulty selects plus Unanswered, Wrong, Favorited chips; filtered views are noindex and link back to the full set.

### 14.5 Sim frame

One bordered Paper panel (radius 16) containing, top to bottom: canvas (with the right-hand inspector on desktop), token legend, caption region, control bar.

- **Canvas**: plain SVG on `--canvas` with 3 to 4 decorative contour lines (`--contour`, 1.5px, `aria-hidden`), as the roadmap `ContourLayer`. Never behind text
  without a node on top. Minimum diagram width 680px; under that the canvas pans sideways inside the panel (hint "Swipe sideways to pan the diagram").
- **Nodes** reuse the roadmap look: pill 40px tall, 1.5px Bark border, Paper fill, station dot 14px ring 3px Trail, label `ui`. Kinds: app, db, client,
  worker, queue as pills; **decision** is a diamond; **cache** (and any node with state) is a 16px-radius card holding its state widget. Hover Pine border;
  focus-visible 3px Trail; selected = Blaze fill and Pine border (one selected at a time); a decide or state event pulses the border Trail for `--sim-pulse-dur`.
- **Edges**: dashed Stone 1.5px with a chevron at the target (the resting prerequisite edge). While a token travels an edge, that edge turns solid 3.5px in the
  token colour. Labels `micro` Moss ("miss", "value", "fill cache"). Geometry comes from the shared `roundedPath`.
- **Tokens**: pill 24px tall, `micro` 600 label, travels one edge in `--sim-hop-dur` at 1x (speed scales it). Request filled Trail with Paper text; response
  outlined `--sim-response`; replicate dashed `--sim-replicate`; error filled `--sim-error`. Transform and opacity only.
- **State widgets** (by `state.type`: lru, queue, kv, counter, ring): live inside the node. LRU: slots 52 x 40, radius 10, most recent on the left, caption
  "most recent to least recent". Touched slot Blaze, newly inserted Known fill, slot about to be evicted dashed Danger border; slots reorder in `--sim-state-dur`.
- **Caption region**: Lane strip under the legend, `aria-live="polite"`, `body` size, with "Step 3 of 5" in `micro`. One sentence per step, states what changed and why.
- **Controls** (always visible, labelled, 44px targets): Play/Pause (primary, label and icon swap), Restart, Back, Step, speed segmented 0.5x, 1x, 2x,
  scenario select on the right. Under 768 labels collapse to icons (aria-labels stay) and the select takes its own row.
- **Inspector**: opens on node click or Enter. Desktop (1024 and up): 320px right-hand panel inside the frame, as the roadmap topic panel (kind in `small`,
  title `h3`, the `inspect` text, then a definition list of live state such as capacity, order, next to evict), Close button on top. Under 1024 it stacks under
  the canvas. **Mobile (under 768): bottom sheet** (Drawer), min 40% and max 90% of the viewport, 16px top radius, grab handle, scrim, slides in `--dur-slow`.
  Focus moves to Close on open and returns to the node on close.
- **Poster and transcript**: the server renders frame 0 and a numbered transcript (`details`: "Read this as text"); the island hydrates when scrolled into view and
  animates only while visible.

### 14.6 Reduced motion, keyboard

- `prefers-reduced-motion: reduce`: **no autoplay** (sim opens paused on frame 0, a note says "Reduced motion is on: step through, or press Play"); **no bubble
  float**; step mode (Back/Step jump between captioned frames, tokens shown at rest on their edge); inspector sheet appears without a slide; pulses and slot motion
  are instant. **Pause is always present**, also when playing by choice (WCAG 2.2.2). The global reduced-motion rule in `theme.css` already shortens transitions.
- Keyboard: Tab reaches the canvas, then each node, then the controls. On the canvas: **Space** play/pause, **Left/Right** step back/forward, **R** restart. On a
  node: **Enter** opens the inspector, **Esc** closes it (from anywhere in the frame) and returns focus. Tabs: arrow keys. Stars and chips: Space/Enter.
- Contrast: all token colours at least 3:1 on Paper and Canvas; text inside tokens at least 4.5:1.

### 14.7 Sim visual polish bar (exit criterion (d) checklist)

A sim passes only if every line is true when replaying all its scenarios at 1x, 0.5x and 2x on desktop and at 375px:

- [ ] Looks like the roadmap: pill nodes with station dots, dashed Stone edges, contour backdrop, Sage and Paper only, no new colours outside section 14.1.
- [ ] No overlapping text or tokens; labels never clipped; token labels are readable at every point of the path.
- [ ] Every token has a colour from the four tokens, a distinguishing shape and a text label; the legend matches what the scenario uses.
- [ ] Each scenario tells one story in 5 captioned steps or fewer; captions say what changed and why, in plain sentences (section 11).
- [ ] Motion is smooth (transform and opacity only), loops cleanly with no jump, and stays under 9 seconds per loop.
- [ ] State widgets always agree with the caption (the evicted key leaves exactly when the caption says so).
- [ ] Controls: play/pause, restart, step back and forward, speed, scenario select, all labelled, 44px targets, visible focus.
- [ ] Inspector: every node has `inspect` text; desktop panel and mobile bottom sheet both open, close with Esc, and return focus.
- [ ] Reduced motion: opens paused, step mode works, nothing floats or autoplays.
- [ ] Keyboard-only run-through (Space, arrows, R, Enter, Esc) works and the caption region announces each step.
- [ ] Works at 375, 768, 1024, 1280px without page-level horizontal scroll (only the canvas may pan); transcript present.
- [ ] No hex values, font names, radii or durations in the component; tokens only.
