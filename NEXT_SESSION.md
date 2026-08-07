# Handoff — floor-card previews and the nine screens

Two pieces of work remain on the design system. They are independent; do them
in either order. **Task A is Claude Code. Task B happens in the browser** —
Claude Code cannot drive the Claude Design agent.

## Where things stand

`src/ui/` is the Station Ledger component library: 22 components, Vite +
TypeScript, no runtime deps beyond React. It is synced to the Claude Design
project **ACTAS OT Calculator** (`d6df1004-e7c3-46f0-835a-8719984bd989`,
https://claude.ai/design/p/d6df1004-e7c3-46f0-835a-8719984bd989). Render check
is clean at 22/22; 11 components have authored preview cards graded good.

There is no app yet — this is the design system only. Phase 0 of
`IMPLEMENTATION_PLAN.md` has not been started.

**Read `.design-sync/NOTES.md` before touching anything.** It records traps
that cost real debugging time: the Playwright pin, the icon-glyph problem, the
`data-theme` cascade, the container query, and the hand-maintained
`dtsPropsFor` entries. Also read `.design-sync/conventions.md` — it is the
brief the design agent itself reads.

---

## Task A — author previews for the 11 floor-card components

These ship fully functional in the bundle but have no rich preview card. They
are the deliberate baseline, not failures.

**Start by typing `/design-sync`** — the skill is reserved for explicit user
invocation and cannot be called by the model. It will detect the pinned
`projectId` in `.design-sync/config.json`, so this is a re-sync: the anchor
lets it skip the 11 already-graded components entirely.

Write one `.design-sync/previews/<Name>.tsx` per component. Each named export
is one graded card cell. Budget 2–6 exports each. Import from `'actas-ot-ui'`
and **wrap every cell in `<StationLedger>`** or it renders unstyled.

| Component | Cells worth having |
| --- | --- |
| `TextField` | hours (`suffix="h"`, `numeric`), money (`prefix="$"`), percent, with `hint`, `overridden` |
| `SelectField` | classification picker (the AP1–AP4 list), date picker, with `hint` |
| `SegmentedControl` | pay step 1–4 (`size="compact"`), the continuous/separate choice with its 4-hour-minimum `hint` and two-line `note` |
| `Toggle` | tax-free threshold on, study loan off, one with a `description` |
| `Tabs` | Quick / Fortnight, each selection state |
| `Panel` | default, `raised`, `flush` holding rows |
| `Money` | default, `tone="out"`, `tone="net"`, `size="display"`, `sign="always-negative"` |
| `Disclosure` | collapsed **with a real summary** (`Deductions: $611 + 5% · Study debt on`), expanded, one nesting a `FigureTable` |
| `Disclaimer` | one cell; it takes no props |
| `EmptyState` | the no-shifts state, one other |
| `Sheet` | the full Add OT shift composition — date, start/end, the continuous/separate control, the live preview panel, the footer button. This is §5.5 and it is the most valuable card in this batch |

Use the real figures from `IMPLEMENTATION_PLAN.md` §4.5 throughout — AP1 Step 2,
$4,908.32 base, the Saturday 10h and Wednesday 2h shifts, $698.34 net delta.
Never `foo`/`test`: humans browse these cards and the design agent imitates
them.

### Traps that already bit this repo

- **Never type an icon glyph.** `⚠` and `✎` render as colour emoji and the
  brief bans emoji. `package-validate.mjs` also treats a leading `⚠` in a cell
  as its own error sentinel, so a component rendering one reports phantom page
  errors whose "messages" are its own text. Draw icons as inline SVG with
  `currentColor`.
- **Anything styled with an explicit `display` that relies on the `hidden`
  attribute needs its own `[hidden] { display: none }` rule**, or it renders
  permanently expanded.
- **A preview whose component self-destructs on a timer captures blank.**
  `UndoRow` previews pass a 10-minute `durationMs` for this reason.
- Check both themes. Dark mode broke once while passing every mechanical check
  — only the review screenshots caught it.

### The gate

Follow the skill's loop: build → validate → capture → **read each
`ds-bundle/_screenshots/review/<group>__<Name>.png`** → write verdicts to
`.design-sync/.cache/review/<Name>.grade.json`. Never grade a sheet you have
not looked at. Iterate until every cell is `good`, then upload.

Expect exactly two `[RENDER_THIN]` warns to disappear as `EmptyState` and
`Sheet` get authored. Any other warn is new — investigate it.

Afterwards, commit the durable set (`.design-sync/config.json`, `NOTES.md`,
`conventions.md`, `previews/`). `upload-manifest.txt` and `upload-batch.json`
are gitignored scratch.

---

## Task B — the nine screens, in Claude Design

Open https://claude.ai/design/p/d6df1004-e7c3-46f0-835a-8719984bd989 and prompt
the agent there. It already has the components, their prop types, and the
conventions header, so **do not re-explain the design language** — just ask for
the screen and name the components.

Priority order is `DESIGN_BRIEF.md` §9. The first five are enough to start
building the app.

1. **Fortnight calculator, populated** (§5.4) — light, mobile. The most
   important frame. `CalculatorLayout`, `ResultPanel` with the comparison
   `FigureTable`, `ShiftList` with two `ShiftRow`s, the add button,
   `Disclaimer`.
2. **Add shift sheet** (§5.5) plus its two variants — overnight (start 22:00,
   end 06:00, showing `Ends next day · Sun 16 Aug` and the rate carried past
   midnight) and minimum-applied (a 2h separate shift paying 4h).
3. **First run / setup** (§5.1) — `SelectField` for classification,
   `SegmentedControl` for step, `DerivedPayPanel`, `Button`.
4. **Quick calculation** (§5.2) — `Tabs`, one `TextField`, `ResultPanel` with
   the "Adds about" label, `AssumptionNote`.
5. **Deductions & tax** (§5.6) — two `TextField`s, the live arithmetic
   `FigureTable`, two `Toggle`s, the packaging/study-loan `AssumptionNote`.
6. Fortnight empty state (§5.3)
7. Fortnight populated, dark (§5.8)
8. "How this was worked out" (§5.7)
9. Desktop layout (§5.9)

Give it the real §4.5 figures. When a screen comes back, check three things:

- Does it use the library components, or has it hand-rolled lookalikes? Ask it
  to use the real ones.
- Is any money figure unexplained? Every one needs its reason on the same line.
- Does it read as an estimate rather than a verdict — no ticks, no
  celebration, no "you'll earn"?

### The success test

§10: hand the populated mockup to a paramedic who has never seen it. Within ten
seconds, without explanation, they should be able to say what the overtime is
worth to them. If they have to ask a question first, the design isn't finished.
Nothing else in this file matters as much as that.

---

## Standing caveat

Every figure in the previews and mockups comes from `IMPLEMENTATION_PLAN.md`
§4.5, which is computed from the EBA tables and **has not been verified against
a real payslip**. That is Phase 10, and it gates sharing the app with anyone. If
the golden fixture moves, the preview cards need re-capturing and re-grading.

## If you wanted real screens instead of mockups

Building the nine screens as actual React in `src/` is a different job — Phase 0
(scaffold, GitHub Actions, `base: '/OTcalculator/'`) and Phase 1 of
`IMPLEMENTATION_PLAN.md`, with `src/engine/` and the §4.5 golden test underneath
them. Say so explicitly if that is what you want; it is not what Task B does.
