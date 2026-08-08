# Handoff — the nine screens

**Task A is done** (2026-08-07). One piece of work remains, and **it happens in
the browser** — Claude Code cannot drive the Claude Design agent.

## Where things stand

`src/ui/` is the Station Ledger component library: 22 components, Vite +
TypeScript, no runtime deps beyond React. It is synced to the Claude Design
project **ACTAS OT Calculator** (`d6df1004-e7c3-46f0-835a-8719984bd989`,
https://claude.ai/design/p/d6df1004-e7c3-46f0-835a-8719984bd989). Render check
is clean at 22/22 with **zero warn lines**, and **all 22 components have
authored preview cards graded good** — there is no floor-card tier left.

**This file is about the design system only.** Since it was written, Phases 0
to 3 of `IMPLEMENTATION_PLAN.md` have landed: the app builds and deploys,
`src/data/` holds the reference tables, and `src/engine/` computes a fortnight
end to end — the §4.5 acceptance fixture passes. None of that touched `src/ui/`,
so everything below still stands. See `CLAUDE.md` for the current state.

**Read `.design-sync/NOTES.md` before touching anything.** It records traps
that cost real debugging time: the Playwright pin, the icon-glyph problem, the
`data-theme` cascade, the container query, and the hand-maintained
`dtsPropsFor` entries. Also read `.design-sync/conventions.md` — it is the
brief the design agent itself reads.

---

## Task A — author previews for the 11 floor-card components — **DONE**

Completed 2026-08-07. `Disclaimer`, `Disclosure`, `EmptyState`, `Money`,
`Panel`, `SegmentedControl`, `SelectField`, `Sheet`, `Tabs`, `TextField` and
`Toggle` all now have authored previews in `.design-sync/previews/`, graded good
and uploaded. Every component carries a `Dark` cell, because dark mode broke
silently here once while passing all mechanical checks.

Two findings worth carrying forward (both recorded in `.design-sync/NOTES.md`):

- `Panel variant="raised"` is **invisible in light mode by design** —
  `--surface` and `--surface-raised` are both `#ffffff` and only separate in
  dark. Its preview renders dark so the variant is actually visible.
- `Sheet` needed `cardMode: "column"`, same as `CalculatorLayout`.

Re-running `/design-sync` from here is a no-op unless `src/ui/` changes: the
anchor carries all 22 grades forward.

### Phase 9 changed `src/ui/`, so the anchor is now stale

The accessibility and mobile passes touched five components and one base rule:

- `Tabs` — roving `tabIndex`, arrow keys, and an optional `idBase` prop that
  ties each tab to its panel.
- `SegmentedControl` — the same roving pattern for the radio group.
- `Sheet` — `Escape` to close, focus on open, `aria-labelledby`.
- `ShiftRow` — the row menu closes on `Escape` and on a tap outside, and its
  trigger is a 44px target.
- `ResultPanel` — the `aria-live` region is now the headline only, with a new
  `.sl-result__headline` wrapper around it.
- **`.sl-stack` gained a gap.** This one moves every preview: the class was a
  bare flex column and is now `gap: var(--stack-gap, var(--space-4))`. Anything
  composed with it will be spaced differently — that is the fix, not a
  regression, but the cards need re-capturing to show it.

So the next `/design-sync` run is no longer a no-op. Re-capture and re-grade at
least those five, and expect the spacing change to show up everywhere.

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

One figure has already moved by a cent: the overtime delta is **$1,110.33 →
$698.33**, not the `$1,110.34 → $698.34` printed in §4.5. The engine carries
full precision to display, per §3.12; the plan's figure sums two already-rounded
line items. Not worth re-grading a card over, but do not "fix" a preview back to
the plan's number.

## If you wanted real screens instead of mockups

Building the nine screens as actual React in `src/` is a different job, and the
groundwork for it is now done — Phases 0 to 3 are complete, so
`calculateFortnight` will hand a screen real numbers today. What remains is
Phase 4 (persistence) and Phases 5 to 8 (shell, the two pathways, results).
Say so explicitly if that is what you want; it is not what Task B does.
