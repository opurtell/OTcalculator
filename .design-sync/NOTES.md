# design-sync notes — actas-ot-ui

Repo-specific gotchas for future syncs. Read before running anything.

## Setup

- **Playwright must be pinned to 1.58.0.** This machine is macOS 13 (Darwin
  22.6.0), and Playwright ≥1.59 refuses to install Chromium there
  (`Playwright does not support chromium on mac13`). The browser cache lives at
  `~/Library/Caches/ms-playwright/` (the macOS path — *not* `~/.cache/`, which
  the skill's check suggests and which does not exist here) and already holds
  `chromium-1208` + `chromium-1223`. v1.58.0 pins build 1208, so it launches
  against the cache with no download. Install it explicitly in `.ds-sync/`:
  `npm i playwright@1.58.0`.
- Build order in `package.json` is `vite build && tsc`, deliberately. Reversed,
  Vite's `emptyOutDir` wipes the declarations tsc just emitted and the
  converter finds no `.d.ts` tree.
- **The dist entry is `./dist/actas-ot-ui.js`** (Vite library mode names it from
  the package, so it is not `index.es.js` as the skill's example assumes). The
  whole re-sync, from the repo root, is:

  ```sh
  node .ds-sync/resync.mjs --config .design-sync/config.json \
    --node-modules ./node_modules --entry ./dist/actas-ot-ui.js \
    --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
  ```

  `--node-modules ./node_modules` is correct here — single package, no monorepo.
- **Don't `cd` into `ds-bundle/` before calling `DesignSync`.** The shell's
  working directory persists between tool calls and `finalize_plan` resolves
  `localDir: "./ds-bundle"` against it, so it fails with `ds-bundle/ds-bundle`.

## Findings from the first sync (2026-08-07)

- **Do not render a literal `⚠` character.** `package-validate.mjs` treats a
  leading `⚠` in a rendered cell as its own in-cell error sentinel, so
  `AssumptionNote` reported 4 pageerrors whose "messages" were just its own
  text content. Nothing was actually throwing — headless Chromium showed zero
  errors. The icon is now an inline SVG, which also satisfies the brief's ban
  on emoji in the interface. Any future component wanting a warning mark must
  draw it, not type it.
- **`data-theme` is stamped on the `StationLedger` div, not on `:root`.** The
  dark-mode token blocks must therefore be written as bare `[data-theme='dark']`
  / `[data-theme='light']`, never `:root[data-theme=…]` — the original scoped
  selectors silently never matched and dark mode rendered fully light while
  passing every mechanical check. Only the review screenshots caught it. An
  explicit `[data-theme='light']` block is required too, so a light island
  inside a dark OS preference repaints.
- Fonts: **IBM Plex Mono only**, vendored from `@fontsource/ibm-plex-mono`
  (OFL), weights 400 + 600, via `src/ui/fonts.css`. The interface sans is
  deliberately the system stack — `DESIGN_BRIEF.md` §4.2 permits it and it
  costs no bytes. Vite's library mode inlines both woff2 as `data:` URIs, so
  `dist/fonts/` is never emitted and `[FONT_MISSING]` stays clear without
  `cfg.extraFonts`. Do not "fix" the missing `fonts/` directory.
- `assetFileNames` in `vite.config.ts` is a function, not a string pattern. A
  plain `actas-ot-ui.[ext]` collapses both font weights onto one filename.

- **`--on-teal` exists because white-on-teal fails in dark mode.** The dark
  teal (`#3d9b9b`) is light enough that a white label sits at 3.30:1, under the
  4.5:1 the brief calls non-negotiable. Anything *filled* with `--teal` must
  take `color: var(--on-teal)` — white in light mode, `#0d151b` in dark (5.58:1).
  Darkening the dark-mode teal instead was rejected: it fixes the fill but drops
  teal-as-text (ghost buttons, links, selected tabs) to 3.56:1. Every other pair
  in both themes passes; re-check with the script in the commit if the palette
  moves.

## Findings from the interaction-components pass (2026-08-07)

- **`display` on a panel outranks the `hidden` attribute.** `InspectableFigure`
  rendered permanently expanded because `.sl-inspect__panel { display: block }`
  beat the UA's `[hidden] { display: none }`. Any element styled with an
  explicit `display` that also relies on `hidden` needs its own
  `[hidden] { display: none }` rule. `Disclosure` is safe only because its
  content block never sets `display`.
- **`✎` is the same trap as `⚠`** — it renders as colour emoji. `TextField`'s
  override marker is now inline SVG. Treat every icon glyph as suspect.
- **The shift list's table treatment is a container query, not a media query.**
  Keyed to the viewport it also fired inside `CalculatorLayout`'s 420px inputs
  column, where four columns don't fit and the rate breakdown wrapped
  mid-phrase. `.sl-shift-list` carries `container-type: inline-size` and the
  columns engage at 560px of list width.
- **`cfg.dtsPropsFor` is required for `FigureTable` and `InspectableFigure`.**
  The extractor emitted `rows: FigureRow[]` without ever defining `FigureRow`,
  so the design agent saw a dangling type and could not know a row takes
  `label`/`values`/`tone`/`total`/`derivation`. Both props bodies are now
  hand-written in the config. **If those component props change, update
  `dtsPropsFor` too** — it is a hand-maintained copy and nothing cross-checks it.

## Findings from the floor-card pass (2026-08-07)

All 11 remaining components were authored, so **every one of the 22 now has a
graded preview** and the floor card is no longer used anywhere in this repo.

- **`Panel variant="raised"` is invisible in light mode, by design.** `--surface`
  and `--surface-raised` are both `#ffffff` there; they only separate in dark
  (`#141f27` vs `#1a2831`). A light-mode `Raised` cell is therefore pixel-identical
  to `Default` and reads as a broken card. The preview renders it dark, stacking
  default above raised so the one-step lift is actually visible. Any future
  variant preview should first check whether its tokens differ in the theme it
  is being shown in.
- **`Sheet` needs `cardMode: "column"`** — same reason as `CalculatorLayout`. Its
  exports are a full add-shift composition, wider than a grid cell, and
  `[GRID_OVERFLOW]` flags them as `wide` without it.
- **`Sheet`'s close button renders a literal `✕` (U+2715) and that one is safe.**
  Unlike `⚠` and `✎` it has no emoji presentation, so it draws as a plain glyph
  and does not trip the validator's in-cell error sentinel. It is the one typed
  glyph in the library — leave it, but do not read it as licence to type others.
- Classification labels are `AP1`/`AP2`/`ICP1`/`ICP2` where the `2` levels mean
  *additional responsibilities* (AP2: Teaching and Development Officer, Station
  Officer, Duty Officer; ICP2: CSO, DO) — **not** a different qualification. The
  descriptions live in the sibling project's plan docs. An earlier draft of the
  `SelectField` preview had AP2 and ICP1 sharing a name; that was wrong.
- `Disclosure` hides its `summary` once open — expected, the summary describes
  the collapsed state. Do not treat a summary-less expanded cell as a defect.

## Known render warns

**None.** The build is clean at 22/22 with zero warn lines. Both prior
`[RENDER_THIN]` warns (`EmptyState`, `Sheet`) are gone now that those components
have authored previews. **Any warn on a future re-sync is new** — investigate it
rather than matching it against this list.

## Re-sync risks

- **Authored previews now cover all 22 components** — there is no floor-card
  tier left in this repo. A re-sync that reports floor cards means preview
  `.tsx` files failed to compile (check the build log for
  `! preview build failed`), not that authoring is outstanding.
- **Every component has a `Dark` cell.** Dark mode broke silently once here
  while passing all mechanical checks, so the theme is exercised per-component
  rather than trusted globally. Keep that cell when editing a preview.
- **`UndoRow` previews pass a 10-minute `durationMs`.** At the real 5000ms
  default the row removes itself before the screenshot and the card captures
  blank. Keep the override in the preview, never in production callers.
- **`cardMode: "column"` on `CalculatorLayout` and `Sheet`** — their stories are
  wider than a grid cell and the product card crops them otherwise.
- **The figures in the previews are unverified.** They come from
  `IMPLEMENTATION_PLAN.md` §4.5, which is computed from the EBA tables and has
  **not** been checked against a real payslip (that is Phase 10). If the golden
  fixture changes, every authored preview's numbers change with it and the
  cards must be re-captured and re-graded.
- The app itself does not exist yet — this is a component library only. When
  Phase 0 adds the app build, `vite.config.ts` gains a second config needing
  `base: '/OTcalculator/'`; keep the library build's config separate or the
  bundle entry the converter reads will move.
- `react@19` has no UMD build, so the converter bundles React via esbuild into
  `_vendor/`. Expect the `has no UMD — bundling via esbuild` line; it is not an
  error.
