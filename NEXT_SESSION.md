# Next session

Phases 0–9 are done and deployed. Three workstreams remain, in this order.
**A** is the gate on everything else; **B** is cheap and overdue; **C** is
polish on the design system.

`CLAUDE.md` is the state of the code. This file is what to do next.

---

## A. Phase 10 — reconcile against real payslips ★ the gate

**Nothing ships to a colleague until this passes.** Everything the app shows is
computed from the EBA tables and the FY2025-26 coefficients and has never been
checked against what payroll actually paid. Until it is, this is a well-tested
hypothesis with a confident-looking UI, which is the more dangerous kind.

**This needs the local machine.** The payslips are deliberately not on GitHub,
so a web session cannot do it — `~/claudeCode/my-actas-pay/personal-payslips/`
holds 35 PDFs. Everything *else* Phase 10 needs (the crossover doc, the EBA
transcription, the pay engine, the interpretation guide) is in the GitHub copy
of the sibling and can be attached with `add_repo`.

How to work it:

1. **Find the fortnights with OT lines.** Not every payslip has one. The
   sibling's `main-plan-docs/actas_pay_tracker_payslip_interpretation_guide.md`
   explains the line codes — read it before interpreting anything, because the
   composite and the roster adjustment appear as their own lines and are easy
   to mistake for overtime.
2. **Re-enter each OT fortnight into the app** (or straight into
   `calculateFortnight` as a test fixture — faster, and it lands as a
   regression test either way).
3. **Compare five things, in this order**, because they fail differently:
   - **The OT hourly rate.** Wrong here means the base-vs-composite trap
     (gotcha 1) and everything downstream is ~34% out.
   - **The per-line categories.** Right total, wrong split means the ratchet's
     labelling rules are off — see the second and third bullets under the
     engine notes in `CLAUDE.md`. This is the most likely divergence and the
     least visible.
   - **The four-hour minimum.** Whether payroll topped up a short standalone
     shift, and whether it ever topped up an overrun (it should not).
   - **The `MEAL ALLOWANCE` line.** How many occasions payroll paid, against
     what the app counted, and at what rate. This is the cheapest check on the
     list and it settles the one open interpretation in `meals.ts` — see step 5.
   - **PAYG.** A cent or two is rounding convention; more than that is a wrong
     scale or a stale coefficient set. The meal allowance must **not** appear in
     the figure PAYG was withheld on; if payroll taxed it, the app's whole
     treatment of it is wrong and not just its count.
4. **Settle the rounding question.** §4.5 prints $1,110.34 by summing two
   already-rounded lines; the engine carries full precision to display per
   §3.13 and gets $1,110.33. If a real payslip sums rounded per-line amounts,
   §3.13 needs an explicit exception for overtime lines — and
   `golden.test.ts` changes with it.
5. **Settle the meal-allowance reading.** `src/engine/meals.ts` implements
   N36.2 on its own terms — overtime worked to the end of a meal period, no
   break, one allowance per window — and deliberately does *not* apply Annex C's
   1.5h/5h/0.5h durations, on the grounds that those hang off a break being
   taken and N36.2 is the exception that replaces it. The consequence is
   testable: a short overrun through a window earns an allowance here and would
   not under a literal Annex C read. Find a fortnight with a short overrun
   across 18:00–19:00 and see whether payroll paid one. If it did not, the
   durations go back in and `meals.test.ts` gains the boundary cases.
6. **Anything that diverges gets a fixture, not a patch.** Add the real
   fortnight as a test case first, watch it fail, then fix the engine.

One thing Phase 10 may also settle, flagged in the plan's §8: whether "current
rates only" is the right v1 answer for historical fortnights. (The other item
that used to sit here — whether the meal allowance belongs in v1 — is closed: it
is built. See `IMPLEMENTATION_PLAN.md` §3.11.)

---

## B. The browser checks Phase 9 never got

Phase 9 was implemented without a working browser — the Chrome extension was
not connected and there is no Playwright here — so its keyboard, offline, print
and small-screen behaviour is written and reasoned about but **never observed**.
Tests, `tsc`, the build assertions and the deployed URLs all pass, which covers
less than it sounds like.

The list is in `CLAUDE.md` under "What Phase 9 still owes you". It is maybe
twenty minutes with the live site at https://opurtell.github.io/OTcalculator/
or a local `npm run preview`, and it should happen *alongside* Phase 10 rather
than after it: a keyboard trap or a broken offline reload found now is cheaper
than one found by the first colleague who opens it.

Note that `npm run dev` has no service worker by design, so anything about
offline behaviour has to go through `npm run preview`.

One item to add to that list, from the shift-caching change: **enter a shift,
reload, and confirm it comes back** — then add a second one and confirm the
first is still there, which is the check that would catch a regression in
`reserveShiftIds`. The expiry itself is awkward to drive by hand (it needs a
Thursday) but can be forced by editing `payPeriodEnd` in the
`actas-ot-calculator/shifts` key in DevTools: the list should come back empty
with a line saying last fortnight's shifts were cleared, and the key should be
gone.

---

## C. The design system

`src/ui/` is the Station Ledger component library: 22 components, Vite +
TypeScript, no runtime deps beyond React. It is synced to the Claude Design
project **ACTAS OT Calculator** (`d6df1004-e7c3-46f0-835a-8719984bd989`,
https://claude.ai/design/p/d6df1004-e7c3-46f0-835a-8719984bd989). All 22
components have authored preview cards graded good; there is no floor-card tier
left.

**Read `.design-sync/NOTES.md` before touching anything.** It records traps that
cost real debugging time: the Playwright pin, the icon-glyph problem, the
`data-theme` cascade, the container query, and the hand-maintained `dtsPropsFor`
entries. `.design-sync/conventions.md` is the brief the design agent itself
reads.

### C1. Re-sync — the anchor is stale

Phase 9 changed `src/ui/`, so `/design-sync` is no longer a no-op:

- `Tabs` — roving `tabIndex`, arrow keys, and an optional `idBase` prop that
  ties each tab to its panel.
- `SegmentedControl` — the same roving pattern for the radio group.
- `Sheet` — `Escape` to close, focus on open, `aria-labelledby`.
- `ShiftRow` — the row menu closes on `Escape` and on a tap outside, and its
  trigger is a 44px target.
- `ResultPanel` — the `aria-live` region is now the headline only, wrapped in a
  new `.sl-result__headline`.
- **`.sl-stack` gained a gap**, which moves *every* preview: it was a bare flex
  column and is now `gap: var(--stack-gap, var(--space-4))`. That is the fix,
  not a regression — the app had no spacing between panels at all before — but
  the cards need re-capturing to show it.

Re-capture and re-grade at least those five, and expect the spacing change
everywhere else.

### C2. The nine screens, in Claude Design

Open the project and prompt the agent there. It already has the components,
their prop types and the conventions header, so **do not re-explain the design
language** — name the screen and the components.

Priority order is `DESIGN_BRIEF.md` §9:

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

**These are now mockups of screens that already exist as real React.** That
changes what they are for: not a spec to build from, but a second opinion on
layout and hierarchy against something shipped. Where a mockup and the app
disagree, the interesting question is which one a paramedic reads faster.

Give it the real §4.5 figures. When a screen comes back, check three things:

- Does it use the library components, or has it hand-rolled lookalikes? Ask it
  to use the real ones.
- Is any money figure unexplained? Every one needs its reason on the same line.
- Does it read as an estimate rather than a verdict — no ticks, no
  celebration, no "you'll earn"?

### The success test

`DESIGN_BRIEF.md` §10: hand the populated screen to a paramedic who has never
seen it. Within ten seconds, without explanation, they should be able to say
what the overtime is worth to them. If they have to ask a question first, the
design isn't finished. Nothing in this section matters as much as that.

---

## Standing caveat

Every figure in the app, the previews and the mockups comes from
`IMPLEMENTATION_PLAN.md` §4.5, computed from the EBA tables and **not verified
against a real payslip**. That is workstream A, and it gates sharing this with
anyone. If the golden fixture moves, the preview cards need re-capturing.

One figure has already moved by a cent: the overtime delta is **$1,110.33 →
$698.33**, not the `$1,110.34 → $698.34` printed in §4.5. The engine carries
full precision to display per §3.13; the plan's figure sums two already-rounded
line items. Do not "fix" a preview or a test back to the plan's number — which
convention is right is a question for A, not a typo.

The fixture has also **gained a figure §4.5 never had**: two N36 meal allowances
on the Saturday, $70.76 untaxed, taking the fortnight to $4,469.42 and the
overtime's worth to $769.09 of $1,181.09 (65.1% kept). Any preview or mockup
showing the populated fortnight now needs the `Meal allowance` and `Total in the
hand` rows, and the headline reads $804.47 on the pathway test's shift pair
(which uses an 18:00–20:00 Wednesday rather than the engine test's 09:00–11:00,
and so earns a third occasion). §3.11 has the rule.
