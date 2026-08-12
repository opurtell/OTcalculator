# ACTAS OT Calculator

A static single-page app for ACTAS paramedics: enter a fortnight's overtime shifts, get pre-tax income, PAYG tax, net income, and the tax-free N36 meal allowance — plus what the OT actually added to take-home. Deployed to GitHub Pages. No backend, no account; settings and the current pay
fortnight's shifts in `localStorage`.

## Status

**Phases 0–9 complete — the engine, persistence, both pathways, the results
display and the polish pass are done and wired together. The app installs,
works offline, prints, keyboards, and says something useful when it breaks.
`App.tsx` connects the persistence layer to the calculator's choices seam; the
§4.5 golden fixture renders end to end through the real UI, with the
with/without comparison, per-shift breakdown, and the §5.7 derivation.**

**The app has now had one browser pass** (Chrome, 1438px, 8 August 2026): the
keyboard, both themes, both pathways and the settings panels were driven by hand
and three layout defects were fixed. **Print, offline and a real phone are still
undriven**, and the pass could not get a narrow viewport. See "What Phase 9 still
owes you" for the split.

Phases against `IMPLEMENTATION_PLAN.md` §6:

| Phase | State |
| --- | --- |
| **0** Scaffold | **Done.** `src/main.tsx`, `src/App.tsx` (a deliberate placeholder — no figures), `.github/workflows/deploy.yml`, live at https://opurtell.github.io/OTcalculator/ |
| **1** Reference data | **Done, with one caveat.** `src/data/` — Annex A tables, ACT holidays, NAT 1004, HELP, FBT caps, the 44-hour roster patterns. Tax and HELP are FY2025-26 only and fall back per §3.8. See "Reference data" below |
| **2** OT engine | **Done.** `src/engine/` — ratchet, categories, attendance grouping, C9.5 minimum, OT dollars |
| **3** Money engine | **Done.** `tax.ts`, `packaging.ts`, `fortnight.ts` — PAYG, HELP, pre-tax deductions, the with/without-OT delta. **The §4.5 golden fixture passes end to end** |
| **4** Persistence | **Done.** `src/storage/` — versioned `localStorage` per §4.4, defensive reads, debounced writes, clear-settings. `preferences.ts` holds the settings; `shifts.ts` holds this pay fortnight's shifts and lets go of them when it ends |
| **5** Shell + setup | **Done.** `src/components/` + `src/app/` — app frame, pathway switcher, pay band picker with editable overrides, deductions and tax panel (simple and advanced — see "Advanced deductions"), disclaimer, clear-settings. `App.tsx` wires the calculator to persistence |
| **6** Quick pathway | **Done.** One hours field, the §5.1 two-tier split, the low-estimate note. Adds `quickOvertime` and the behaviour-preserving `comparePay` extraction in `src/engine/` |
| **7** Fortnight pathway | **Done.** Shift list, add/edit sheet with live preview, delete-with-undo, duplicate, the roster quick-fill, and the five non-blocking warnings. A row is an attendance, not an entry |
| **8** Results | **Done.** The with/without comparison table, an inspectable per-shift Overtime breakdown, the tax-free meal allowance line and its per-occasion derivation, the §5.7 "how this was worked out" disclosure, and the advanced split's "Where your money goes" / Spendable disclosure. Row logic lives in `src/app/breakdown.ts`; `HowItWasWorkedOut.tsx` and `WhereYourMoneyGoes.tsx` wrap the two disclosures |
| **9** Polish | **Done; verified in a browser at desktop width only.** Keyboard operation of the tabs and segmented control, the tab panel, a narrowed live region, Escape and focus return on the sheet and row menu; 44px targets, 16px inputs, a capped sticky result on desktop, safe areas; PWA with a hand-rolled service worker; print stylesheet and a shareable text summary; an error boundary and the settings-repair notice; a copy sweep against the §6 deck |
| **10** Validation | **Not started, and it is the gate.** Reconcile against the 35 payslips in the sibling repo. Needs the local machine — they are deliberately not on GitHub. Method in `NEXT_SESSION.md` |

`calculateFortnight(shifts, settings)` in `src/engine/fortnight.ts` is the entry
point — shifts and settings in, take-home and the overtime delta out. It calls
`calculateOvertime` underneath, which is usable alone if you only want gross OT.
578 tests. All seven crossover worked examples pass. Four things to know:

- **The meal allowance is the one untaxed figure, and it sits outside
  `PayComparison` deliberately.** `src/engine/meals.ts` pays $35.38 once when a
  **10-hour shift runs an hour or more over**, and `calculateFortnight` adds it
  *after* PAYG. It is never in `gross`, `taxableGross` or `net`; `netTotal`,
  `otEarnedTotal` and `otNetTotal` are where it lands. Folding it into gross would
  have tax withheld on it, which is the one thing that must not happen. The rule
  is ACTAS practice rather than N36.2's literal words — **two readings derived
  from the clause text shipped and both were wrong about the money**. See "The
  meal allowance" below before changing anything here.
- **The §4.5 golden total is a cent adrift**, and it is the plan that is out.
  See `src/engine/__tests__/golden.test.ts` — §3.13 says full precision until
  display, which gives $1,110.33; §4.5 prints $1,110.34, the sum of the two
  already-rounded lines. Both line items are exact. Oscar has accepted the
  divergence; Phase 10 settles which one payroll does.
- **The delta is computed by running the whole fortnight twice**, not by
  applying a marginal rate. PAYG is withheld on the fortnight's total and
  rounds at the weekly step, so the marginal rate is not the answer.
- **The ratchet's two labelling rules are load-bearing** and neither is
  obvious. Ties go to the calendar, so a Saturday running into Sunday tags the
  Sunday hours `sun_2x`. But the weekday counter advances *only while a weekday
  rate is actually being paid*, so Sunday 22:00 → Monday 06:00 stays `sun_2x`
  for all eight hours rather than turning into `mf_2x` partway. Get the second
  one wrong and the money is still right — only the line items stop matching
  payroll, which is exactly what Phase 10 reconciles.

`src/storage/preferences.ts` is the persistence layer; `src/App.tsx` is the only
place that reaches for it rather than touching `localStorage` directly. Three
things it settles:

- **Reading never throws and never trusts.** Corrupt JSON, an unrecognised
  `schemaVersion`, a `localStorage` that throws on *property access* (Safari
  private browsing does) all yield `DEFAULT_PREFERENCES`. Fields are repaired
  individually, so a lost deductions key does not discard the pay band the user
  did enter. `readPreferences` reports `'repaired'` when that happened, and
  Phase 9 wired it: `readNotice` in `Calculator.tsx` turns it into a line
  inside the Pay band panel rather than silently resetting a figure.
- **Shift entries are kept for their pay fortnight, and no longer.** They live
  in their own key — `src/storage/shifts.ts` — stamped with the pay period they
  belong to, and a read for any other period discards them and removes the
  record from the device. That expiry is the whole reason saving them is safe:
  the stale-data trap §4.4 refused to open is specifically last fortnight's
  overtime reappearing in this fortnight's total, not a shift surviving a
  reload. Two keys rather than one field, because a shared key would need a
  schema bump and a bump discards the record wholesale — every existing user
  would lose the pay band they set. See "The pay fortnight" below.
- **Writes are debounced, and `flush()` is wired to `pagehide` in `App.tsx`.**
  Without it the last edit is lost when a tab closes inside the delay window,
  and `pagehide` is the event that fires on mobile Safari where `beforeunload`
  does not.

Storage validates shape, not meaning: a stored band of `AP9 Step 99` round
trips, because `payBandFor` already returns `undefined` for stale settings and
duplicating Annex A behind a browser API would be the worse coupling.

## Advanced deductions, and Spendable

The "Advanced" toggle in the Deductions & tax panel splits the one pre-tax field
four ways — **pre-tax super, living expenses, meals and entertainment, union
fees** — and unlocks the "Where your money goes" disclosure in the result panel,
whose bottom line is **Spendable**.

**It changes no tax figure, and that is the design.** `advancedDeductionSettings`
in `src/engine/packaging.ts` collapses the four categories back to the two knobs
the withholding calculation has always taken: the three value-only categories
plus a dollar super contribution become `fixedPerFortnight`, and a percentage
super contribution becomes `percentOfGross`. Advanced mode is a different set of
*questions*, not a different sum, which is why nothing in the tax path had to
learn about it. `src/app/settings.ts` (`deductionSettingsFor`) is the one place
that collapse happens.

Six things about it:

- **Spendable is take-home plus living expenses plus meals and entertainment,
  and nothing else.** Those two leave the payslip and come back — to a mortgage,
  a rent payment, a packaging card — and get spent like any other dollar. Super
  is locked away and union fees have already been spent, so both are shown in
  the breakdown and then deliberately left out of the total. It starts from
  `netTotal`, not `withOt.net`: the tax-free meal allowance is in the account by
  the same test as the rest of take-home.
- **Only super has a percentage option, and it bites on the whole gross** —
  overtime included, before anything else comes out, exactly as the single
  percentage field always has. The other three are amounts, because nobody
  states a rent payment or a union fee as a share of their salary.
- **Both super figures are stored, and `superMode` decides which is live.**
  Switching between percentage and set amount must not be destructive, so the
  unselected figure is remembered — and `activeAdvancedDeductions` zeroes it on
  the way to the engine, so a remembered keystroke can never reach a figure. Same
  reasoning as the pay band keeping `annualBase` and `fortnightlyGross` together.
  The simple mode's two fields survive a trip through advanced mode for the same
  reason.
- **It shipped without a `SCHEMA_VERSION` bump, and the mechanism is load-bearing.**
  `deductions.advanced` is an *optional* key: absent on a record written before
  the feature, and absent on a record belonging to someone who never opened the
  toggle (`deductionChoiceFrom` omits it when it holds nothing). `undefined` is
  dropped by `JSON.stringify` on both sides of `fieldsSurvived`, so those records
  still read back `'ok'` rather than `'repaired'`. A bump would have discarded
  every stored record and cost every existing user the pay band they set. Do not
  turn the key into a required field of zeroes.
- **The cap is allocated proportionally.** `computeDeductions` caps the total at
  gross; `advancedBreakdown` scales every category by the same factor so its
  lines still sum to that total. A breakdown that summed past its own total would
  be the app contradicting itself on screen — the failure the deductions panel
  exists to prevent. `money.test.ts` holds the two totals equal across a range of
  grosses.
- **No Spendable figure in simple mode.** One field over several unrelated things
  cannot tell packaged living expenses from salary-sacrificed super (trap 6), so
  the disclosure is not rendered at all rather than guessing. Same reason trap 6
  gives for having no FBT-cap warning.

The Spendable block also travels in the shared text summary (`src/app/summary.ts`),
naming all four categories including the two it does not add back — read away
from the app, a Spendable figure with no account of what was left out is exactly
the unexplained figure that file exists to avoid.

## The meal allowance

`src/engine/meals.ts` prices the overtime meal allowance. **$35.38 per occasion**
(Annex C, the 1.93% column effective 4 December 2025), with the whole C20.2
progression in `src/data/allowances.ts`, looked up by pay date.

**The rule: a 10-hour shift that runs an hour or more over earns one allowance.
Nothing else earns anything.**

Not the meal periods, not whether a break was taken. The system takes the break
you were due during the shift as having been given — N35.3 entitles you to 30
minutes within five hours of continuous duty, and N35.7 gives a 10-hour shift
exactly **one** Window of Opportunity to take it in. Past eleven hours a *second*
break falls due, and that is the one you will not get, so the allowance stands in
for the meal you have to buy.

`dutyFor` places the boundary from the roster patterns, and there is no
calculation at all without one:

- **`overrun`** → the pattern whose **end** time is the overtime's start; the
  shift's length comes from the pattern, since the shift itself is never entered.
- **`separate`** → the pattern whose **start** time is the attendance's start: a
  picked-up shift entered as one period, treated exactly as a normal shift.
  `06:30–17:30` earns; `06:30–16:30` earns nothing.
- **Neither → nothing, silently.** Oscar's call. Guessing a boundary from an
  unrecognised time would invent the one fact the rule turns on.

Eight things about it, and most of them are easy to break:

- **This is practice, not clause text**, and it sits on the same footing as the
  midnight ratchet: operational convention confirmed by Oscar that the agreement
  does not spell out. **Two earlier readings derived from N36.2's actual words and
  both were wrong about the money** — history in `IMPLEMENTATION_PLAN.md` §3.11.
  Do not "correct" this back towards the clause text without a payslip.
- **`MEAL_PERIODS` is kept and nothing reads it.** N36.3's four windows
  (midnight–01:00, 07:00–09:00, 12:00–14:00, 18:00–19:00) are transcribed source
  on the same footing as `PACKAGING_CAPS`. `meals.test.ts` asserts they do *not*
  change the answer, because two implementations turned on them. They are also
  **not** N35.7's Windows of Opportunity — the break windows, which are what the
  rule above actually rests on.
- **One allowance, however far over.** Four hours over pays the same as one.
- **12-hour shifts (D, PM) are outside the rule at any length**, because N35.7
  gives them two break windows each. Oscar stated the rule for 10-hour shifts and
  named 06:30 and 21:00; erring towards no allowance keeps the app on the side it
  errs on everywhere else. **This is the open Phase 10 question.**
- **The hour is measured on minutes worked, not elapsed.** An unpaid gap inside
  the attendance does not count towards it, and the C9.5 top-up cannot buy it — a
  30-minute call-in pays four hours and still only kept you there thirty minutes.
- **It is added after tax, and that is the whole point.** `mealAllowance` sits
  outside `PayComparison` so nothing in the tax path can see it. If you find
  yourself adding it to `gross` to make a total balance, the total is wrong, not
  the structure.
- **`roster-shifts.ts` is now load-bearing for money.** It began as a shift-sheet
  quick-fill; the engine takes it as `meals.rosterShifts`. A mistyped time there
  silently removes someone's allowance, and the four **end** times must stay
  distinct from each other or an overrun cannot be attributed.
- **21:00 is the one collision, and `kind` resolves it — for money now.** It is
  both the D shift's end and the N shift's start. An overrun there ran on from a D
  (12 hours, nothing); a separate attendance there is a picked-up N (10 hours,
  inside the rule).

Late meal (O13/P15) and spoilt meal (O14/P16) do not apply to this cohort —
Sections O and P; N43.1 lists what the 44-hour roster substitutes, and "spoilt"
appears nowhere in Section N. The note at the bottom of `src/data/allowances.ts`
exists so nobody adds them from a table of contents.

One transcription trap in the rate table: **the C20.2 increases compound on the
unrounded figure, not the printed one.** Applying the percentages to each
published dollar amount in turn gives $33.06 where Annex C prints $33.05, and the
cent carries forward. `reference-data.test.ts` holds the whole chain to the right
rule, which is what a future row should be checked against.

## The pay fortnight

Pay fortnights run **Thursday to Wednesday**. The anchor — the period ending
Wednesday 29 July 2026 — is in `src/data/pay-periods.ts`; every other period is
counted off it by `payFortnightFor` in `src/app/pay-period.ts`. It decides one
thing only: how long the app holds on to the shifts someone typed. Nothing in
`src/engine/` reads it, because a pay period does not change what overtime is
worth.

Four things about it are load-bearing:

- **The period's end date is its identity in storage.** A date rather than an
  index, so a stored record still says which fortnight it came from if the
  anchor is ever corrected — and any period that is not the one being asked
  about is expired, including a *later* one, which is what a device with a
  wrong clock produces.
- **`endsNextDay` is derived on read, never trusted.** It is a function of the
  two times, so a stored disagreement is corruption rather than a second
  opinion, and a hand-edited `localStorage` cannot talk the engine into pricing
  a negative-length attendance.
- **Restored shifts must reserve their ids before anything is added.**
  `newShiftId()` counts from zero on every load, and `upsertShift` matches on
  id — so without `reserveShiftIds` (called in `App.tsx`'s boot initialiser) the
  first shift a user adds silently overwrites a restored one. This is the one
  part of the feature that fails quietly.
- **The app says what it is holding.** A restored list names its fortnight; a
  list that expired between visits says so rather than presenting itself as a
  fresh start. Same principle as never showing an unexplained figure — an empty
  list the user did not empty needs an explanation as much as a number does.

Clearing is two controls with different manners. **"Clear shifts"** is one tap
beside the list and goes through the ordinary deletion path, so the undo row
puts the whole list back. **"Clear saved settings"** asks first, because
nothing survives it — and it drops the shifts too, which is why its question
names them.

`src/ui/` is the Station Ledger component library — 22 components covering the
nine screens, React the only runtime dep. It is pushed to the Claude Design
project `ACTAS OT Calculator` (`d6df1004-e7c3-46f0-835a-8719984bd989`) so the
design agent composes with the real components. Render check clean at 22/22 with
zero warns; all 22 components have authored preview cards graded good.

**Phase 9 changed `src/ui/`, so the design-sync anchor is stale.** `Tabs`,
`SegmentedControl`, `Sheet`, `ShiftRow` and `ResultPanel` all moved, and
`.sl-stack` gained a gap that changes every preview's spacing — see
`NEXT_SESSION.md`. Re-syncing is a browser task.

**`.sl-stack` had no gap until Phase 9**, which meant every panel in the app
sat welded to the next one. It is `gap: var(--stack-gap, var(--space-4))` now,
with `.sl-app` setting a roomier `--stack-gap` for the page column. Nothing in
the library carries margins of its own, so if a screen ever looks cramped, this
is the first thing to check. It is also a reminder worth keeping: the app was
built for four phases without anyone opening it in a browser.

**There are two Vite configs and mixing them up wastes a session.**
`vite.config.ts` is the *app* build (`base: '/OTcalculator/'`, output `dist/`,
and the `pwa()` plugin from `vite-pwa.ts`). `vite.config.lib.ts` is the
*library* build for the design sync (output `dist-lib/`, `npm run build:lib`,
`publicDir: false` so the app's icons stay out of it). `package.json` still
carries the library's `name`, `exports` and `peerDependencies` — that metadata
describes `dist-lib/`, not the app.

**The roster quick-fill is derived, not stored.** `AM`/`D`/`PM`/`N` in the shift
sheet fill the two time fields from `src/data/roster-shifts.ts`; which code shows
as selected comes from `rosterShiftFor(draft)` reading the fields back, not from
a code kept on the draft. Do not "simplify" it into draft state — the whole
point is that the control cannot claim `D` while the fields say 09:00–22:00, so
editing a time clears the selection and a pattern typed by hand lights it up.
Two more things it settles: it writes only the times, so a shift that ran forty
minutes over is one tap and one edit; and it re-infers the C9.5 kind rather than
setting it, so a user who has already answered that question keeps their answer.
The four durations sum to 44 hours, which is the only checkable property of the
transcription and is asserted in `data/__tests__/roster-shifts.test.ts`.

## The polish layer, and where it lives

Phase 9's work is spread thin by nature, so this is the index:

| Concern | Where |
| --- | --- |
| Arrow-key navigation for the tabs and segmented control | `src/ui/roving.ts` — pure index arithmetic, DOM half separate so the part that can be wrong is testable |
| Tab ↔ panel wiring | `Tabs.tsx` (`idBase`, `tabId`, `tabPanelId`) and `CalculatorShell.tsx`, which renders the panel |
| Escape, focus-in, focus-return | `Sheet.tsx` and `ShiftRow.tsx`; the *return* target is `Calculator.tsx`'s `sheetOpenedFrom`, because only the opener knows where focus came from |
| Touch targets, iOS input zoom, the desktop-only sticky result | `src/ui/components.css` |
| Page ground, safe areas, print | `src/styles/app.css` |
| Service worker | `vite-pwa.ts` (build-time plugin), registered in `src/main.tsx` |
| Icons and manifest | `scripts/make-icons.mjs` → `public/` |
| Shareable text | `src/app/summary.ts` (pure) behind `src/components/ShareSummary.tsx` |
| Render failures | `src/components/ErrorBoundary.tsx`, wrapped around `Calculator` in `App.tsx` |
| Settings-repair notice | `readNotice` in `Calculator.tsx`, fed by `App.tsx` from the read status |

Five rules in there are easy to undo by accident:

- **There is exactly one `aria-live` region on screen, and it is the headline.**
  Every keystroke moves these figures; a region wrapped around the comparison
  table re-reads the whole thing each time, which is how a helpful announcement
  becomes something the user switches off. `calculator.test.tsx` asserts the
  count, so widening it fails a test rather than shipping.
- **The warnings container is always rendered and never hidden.** A live region
  has to exist *and be displayed* before its content arrives, or the first
  warning — the one that matters, because it responds to what was just typed —
  goes unannounced. It has its own `.sl-warnings` class for exactly this
  reason; do not "tidy" it into a `.sl-stack` that collapses when empty.
- **The 16px input rule is keyed to `pointer: coarse`, not to a width.** Mobile
  Safari zooms the page when a field under 16px takes focus and does not zoom
  back out. The obvious `max-width` query leaks: an iPhone Pro Max in landscape
  is 932 CSS px and an iPad is wider still in both orientations. The width arm
  is kept so a narrow desktop window is unchanged, but the pointer arm is the
  one doing the work.
- **The result panel is sticky only at ≥900px, and only `.sl-layout__result`
  pins it.** Over a single column a pinned panel covers the field being typed
  into, which is what it did on a phone. `ResultPanel` used to take a `sticky`
  prop as well; it was removed rather than fixed, because two places that can
  pin the same panel is how the mobile case survived being noticed.
- **The desktop column widths and `--measure` are one change, not two.** The
  grid is 420px + 340px + a 32px gutter, which needs `--measure: 824px` — set in
  the `min-width: 900px` block of `tokens.css`. Narrow the measure back to 720
  and both columns shrink silently: the comparison table loses enough label
  column to break "Take-home" at its hyphen, and if you widen the result column
  to fix that, the shift row starts wrapping its date instead. 720px is still
  the reading measure below 900px, and `.sl-disclaimer` caps itself so the fine
  print does not stretch with the grid.

**Sharing is text, never a URL.** No pay band or roster is encoded into the
address bar, deliberately — see `IMPLEMENTATION_PLAN.md` §4.7. The summary
always ends with the disclaimer, because an estimate that leaves the device has
to carry its caveat with it.

What to do next — Phase 10, the browser checks, and the design system, in that
order — is in `NEXT_SESSION.md`. The design-system half needs a browser and
cannot be done from Claude Code.

## What Phase 9 still owes you

Phase 9 was written without a working browser. It has since had one pass in
Chrome at a 1438px viewport (8 August 2026), which found and fixed three things
no node test could see — the settings disclosures sitting on their panel
borders, the result panel pinned over the single column, and `PAYG tax` running
into its own figure. What that pass **confirmed working**, so nobody re-checks
it: arrow keys on the tabs and on both segmented controls with selection
following focus and a visible ring; `Escape` closing the shift sheet and
returning focus to the button that opened it; light and dark at every step; both
pathways' figures against the §4.5 fixture; the roster quick-fill end to end;
and no console warnings anywhere.

What that viewport could not reach — the extension's `resize_window` had no
effect on the window — and what someone should still actually try:

- **A real iPhone.** The 16px input rule is the fix for zoom-on-focus and no
  desktop browser reproduces the behaviour, so this one needs the phone. The
  roster control was checked at a 286px container instead, which is what a 320px
  phone gives it: four 66px columns, nothing overflowing.
- **Offline.** `npm run build && npm run preview`, load once, go offline in
  DevTools, reload. Confirm the app returns and a rebuild is picked up on the
  next load. The worker is `vite-pwa.ts` and is emitted on build only.
- **Print.** One clean page, disclosures open, no buttons or tabs, disclaimer
  present.
- **A genuinely narrow viewport.** 320px and 390px: no horizontal scroll, and
  the single-column layout end to end rather than a width-constrained element
  inside a wide one.
- **The capped sticky result at ≥900px** with the derivation open — that it
  scrolls within itself rather than hiding its own bottom. **Advanced mode makes
  this taller**: a second disclosure sits above the §5.7 one, so the result
  column now has more to scroll than the pass on 8 August ever saw.

**Advanced deductions has not been in a browser at all.** Its five fields, the
super percentage/set-amount segmented control and the "Where your money goes"
disclosure were built and tested the way Phase 9 was — from node. Drive the
toggle both ways, arrow the super control, and check the deductions panel does
not outgrow a 320px column with five fields in it.

`src/ui/__tests__/contrast.test.ts` does hold the line on §8's contrast
requirement in both themes, and asserts the three copies of the palette in
`tokens.css` still agree, which is the failure that bit last time.

Do these alongside Phase 10 rather than after it — `NEXT_SESSION.md` §B. It is
about twenty minutes against the live site, and a keyboard trap found now is
cheaper than one found by the first colleague who opens the app.

**`@types/node` is a real dependency now** — `contrast.test.ts` reads
`tokens.css` off disk, and `scripts/`, `vite-pwa.ts` and `vite.config.lib.ts`
all use node built-ins. It was missing at first and `tsc` still passed locally,
because TypeScript walks *parent directories* for `node_modules/@types` and
found a stray copy in the home directory; CI has no such thing and failed on
`Cannot find module 'node:fs'`. If a typecheck ever passes here and fails in
CI, check for a resolution that escaped the repo:
`npx tsc --noEmit --typeRoots ./node_modules/@types` reproduces CI's view.

The service worker deliberately has no `skipWaiting`: a new version takes over
on the next load rather than swapping assets under a session mid-calculation.
Icons are drawn by `scripts/make-icons.mjs` (no image dependency — it encodes
the PNGs itself) and committed to `public/`; rerun it only if the mark changes.

**The mark is a clock with a dollar badge** — the hours, and what they are
worth. It replaced three abstract ledger rules that said "a document" and
nothing about pay or overtime, so the design language is still Station Ledger
but the icon no longer depicts a ledger page. Three things about it:

- **It is signed distance fields, not paths**, because that is what rasterises
  without a font or an image library. The `$` is two 270° arcs and a stroke,
  which is how a geometric dollar sign is drawn anyway. Any change to the mark
  has to stay inside that vocabulary — circles, arcs, capsules — or the script
  needs a new primitive first.
- **The badge is load-bearing at small sizes.** A clock and a `$` overlaid, or
  a `$` inside the clock ring, both turn to mush at 32px; a `$` on its own disc
  keeps a separate silhouette. A bare ring around a `$` also reads as a *coin*
  rather than a clock, which is why the hands are there and the tick marks
  are not.
- **The favicon in `index.html` is the same geometry by hand**, as an SVG data
  URI. Its numbers must match the constants at the top of the script — clock at
  (13.2, 13.2) r 9.8, badge at (23, 23) r 7.6 — or the tab and the home screen
  drift apart.

`src/ui/__tests__/icons.test.ts` decodes the committed PNGs and holds them to
what each platform does with them. The two rules are genuinely different and
the test keeps them apart: **Android's maskable icons** must keep their mark
inside the middle 80% (a launcher crops to its own shape), while
**apple-touch-icon** only has its corners trimmed, so holding it to Android's
safe circle would shrink it on the platform that never needed it shrunk. All
three are opaque edge to edge, which is the one rule they share.

## Read these first

| Document | What it covers |
| --- | --- |
| `IMPLEMENTATION_PLAN.md` | The calculation spec (§3 is authoritative), tech design, 11 phases, risks |
| `README.md` | Commands, layout, and the two deploy settings that are easy to get wrong |
| `DESIGN_BRIEF.md` | Design language, tokens, 9 screen wireframes, copy deck, a11y |
| `NEXT_SESSION.md` | **Start here next session.** Phase 10, the browser checks Phase 9 never got, and the design-system work — in priority order |
| `.design-sync/NOTES.md` | **Read before any design-sync run.** Playwright pin, icon-glyph traps, the `data-theme` cascade, hand-maintained `dtsPropsFor` |
| `.design-sync/conventions.md` | The component-usage contract the Claude Design agent reads |

§3 of the plan is the product. Everything else is plumbing around it.

## Sibling project — read, don't depend on

`~/claudeCode/my-actas-pay` (note the hyphens) is the ACTAS Pay Tracker: a Next.js/Cloudflare app that verifies real payslips. It holds the EBA transcription, Annex A pay tables, a tested pay engine, verified ATO NAT 1004 coefficients, ACT public holidays, and 35 real payslips.

**Port code from it; never add it as a dependency.** This app is zero-dependency and static; that one is a full stack app. Full source index in `IMPLEMENTATION_PLAN.md` §9.

**In a remote session, add it — do not work around it.** Claude Code on the
web clones this repo alone, but the sibling is on GitHub at
`opurtell/my-actas-pay` and can be attached mid-session with `add_repo`. The
GitHub copy carries everything except `personal-payslips/`.

Two things about a remote session are worth knowing before planning:

- **Phase 10 is the only thing the GitHub copy cannot unblock.** The 35
  payslips are deliberately not in the repo. Everything else — the crossover
  doc, the reference data, the EBA transcription, the pay engine — is there.
- **Outbound network is blocked to almost everything.** The egress proxy
  allows the npm registry and GitHub and refuses `ato.gov.au`,
  `softwaredevelopers.ato.gov.au` and `data.act.gov.au`. Web *search* returns
  snippets but pages cannot be fetched, so §3.8's "source NAT 1004 from the
  ATO" is a local-machine task. Never transcribe tax coefficients out of a
  search snippet.

## Reference data

`src/data/` holds every rate, table and threshold, each with a provenance
comment naming its source. Nothing in there should ever acquire a figure
without one.

The engine takes every figure it uses as a **parameter** — `PayBand`,
`TaxScale`, `HolidayCalendar`, the meal-allowance rate — and holds none of its own
beyond the EBA's structural constants (76 fortnightly hours, the `12/313`
divisor, the rate multipliers, the N36.3 meal windows). The arrow runs one way, `data/` → `engine/` types only, and
`src/engine/__tests__/boundary.test.ts` enforces it. That is what lets a
fortnight from an earlier financial year keep computing against the figures
that were current when it was worked.

Three tables in there are read by no engine code, which is deliberate rather
than rot: `packaging.ts` (see the FBT note below), `roster-shifts.ts`, which the
shift sheet reads, and `pay-periods.ts`, which only storage's expiry cares
about. A figure being *in* `data/` does not mean the money depends on it.

`allowances.ts` is the exception that proves the rule: it holds the Annex C
overtime meal rate, which the money *does* depend on — but the engine still takes
it as a number. `src/app/settings.ts` looks it up by pay date, which is what keeps
an older fortnight priced at the rate in force when it was worked (C20.2).

**Tax and HELP are FY2025-26 only.** The ATO reissued Schedule 1 for FY2026-27
(second bracket 16% → 15%) but those coefficients are not in the sibling repo
and cannot be fetched from a web session. `taxScaleFor` and `helpScheduleFor`
fall back to FY2025-26 per §3.8 and report `isFallback` so the UI can caption
it. Adding the real rows to `src/data/tax-scales.ts` is the entire fix — no
engine change. Remove the caption, never the fallback.

Confirmed against source while porting: AP1 Step 2 is $95,698 base / $125,920
Annex A total, the FY2025-26 Scale 2 coefficients reproduce the §4.5 PAYG figures
($1,208 and $1,620) exactly, and the Annex C overtime meal rate is $35.38 per
occasion from 4 December 2025.

## Seven things that will bite

1. **Overtime is calculated on base salary only** — EBA N34.1, never the composite-inclusive Annex A total. AP1 Step 2 is $95,698, not $125,920. Getting this wrong overstates every result by ~34%. Needs a named constant and an explicit test.

2. **The midnight ratchet.** Once an OT attendance starts the rate only goes up, never down, even across midnight — and the Mon–Fri "first 2 hours at 1.5×" counter does not reset at midnight. This is ACTAS payroll convention, not EBA text. Rule and seven worked examples: `~/claudeCode/my-actas-pay/main-plan-docs/actas_pay_tracker_ot_midnight_crossover.md`.

3. **The 4-hour minimum is for standalone shifts only.** EBA C9.5 applies when
   OT is *not* continuous with ordinary duty — a called-in or picked-up shift.
   A shift overrun never attracts it: you have already worked your rostered
   hours, so the OT is paid at actual duration however short. Oscar confirmed
   this is how every case he will enter behaves. Never top up an overrun.

4. **Saturday overtime is double time from the first minute** — there is no
   1.5× opening tier on a Saturday for this cohort. The general ACT public
   sector clause C9.12 *does* put Mon–**Sat** at time-and-a-half for the first
   2 hours, but **N34 explicitly overrides C9.12 for Mon–Sat** and says
   "Saturday: Double time for all overtime worked". Section N covers Emergency
   Operations — paramedics and ICPs — so N34 is the one that applies. If
   someone reports Saturday starting at 1.5×, they are reading C9.12. Getting
   this wrong costs about $48 on the §4.5 golden fixture's Saturday pickup.

5. **`vite.config.ts` carries `base: '/OTcalculator/'`.** GitHub Pages serves
   from a subpath; the Vite default of `/` gives a blank page with a 404 on
   every asset. The deploy workflow asserts the built `index.html` has subpath
   asset URLs, so this cannot regress silently — do not "tidy" the base away.

6. **"Pre-tax deductions" is one field over several unrelated things, so it
   cannot be checked against the FBT caps.** Living-expenses packaging and a
   novated lease count towards the $9,010 cap; salary-sacrificed super does not,
   and super is both the commonest entry and easily large enough to clear the cap
   on its own. A cap warning therefore fires hardest on the case where it is
   simply wrong. Oscar had one removed for exactly this reason — it was
   overstepping. `PACKAGING_CAPS` stays in `src/data/` as transcribed reference
   data with nothing reading it; `packagingFlags` carries the note. If a future
   version wants the check, it needs the field split by purpose first.
   **Advanced mode is that split**, and it is what makes the Spendable figure
   possible — but it is opt-in, so the cap check still cannot come back for
   everyone, and it stays out. See "Advanced deductions, and Spendable".

7. **The meal allowance is a 10-hour shift going an hour over, and nothing
   else.** It is ACTAS practice, not N36.2's words — a paramedic's break is taken
   as given, and the allowance is for the second break they are owed past eleven
   hours and will not get. **Two implementations derived from the clause text and
   both disagreed with payroll**: one paid every standalone pickup, the other
   paid nothing on any overrun under two hours. The N36.3 meal periods are still
   in the engine and nothing reads them, with a test asserting they change no
   figure. Also: 12-hour shifts earn nothing at any length, and adding the
   allowance to `gross` would withhold tax on a tax-free figure. See "The meal
   allowance" above.

## EBA status

The ACTAS Enterprise Agreement 2023–2026 **remains in effect**. Its 31 March 2026 nominal expiry has passed but no successor exists — negotiations ongoing as at August 2026. The 4 December 2025 rates are current and authoritative. Build against them without hedging about currency. Oscar will say when a successor is signed.

## Conventions

- The `src/engine/` directory is pure functions — no DOM, no React, no imports from `components/` or `storage/`. That boundary is what makes the money math testable.
- Full precision through the calculation; round to cents only at display. The one exception is PAYG withholding, where NAT 1004 mandates rounding at the weekly step.
- Dates are `IsoDate` strings (`'YYYY-MM-DD'`) and `Minutes` integers (0–1439). No date library — the Temporal polyfill is ~200KB and every time in this app is ACT wall-clock.
- Never show an unexplained figure. If the app pays 4 hours for 2 hours worked, it says why on the same line.

## Acceptance test

The golden fixture in `IMPLEMENTATION_PLAN.md` §4.5 — AP1 Step 2, one Saturday
10h pickup + one Wednesday 2h overrun — **passes end to end** in
`src/engine/__tests__/golden.test.ts`. Ordinary gross $4,908.32, with-OT gross
$6,018.66, PAYG $1,208 → $1,620, net $3,700.32 → $4,398.66, and $1,110.33 of
overtime worth $698.33 in the hand at 62.9% retained.

**Neither shift earns a meal allowance**, and that is the answer rather than an
omission: the Saturday matches the D shift's start, a 12-hour pattern outside the
rule, and finishes early besides; the Wednesday overrun starts at a time no roster
shift ends at. The allowance case is covered separately in `golden.test.ts` by an
AM picked up and entered as `06:30–18:00` — a 10-hour shift taken to 11.5, $35.38
untaxed, PAYG unaffected. The same shift entered as `06:30–16:30` earns nothing.

It is computed from the EBA tables and the FY2025-26 coefficients, and is
**not yet verified against a real payslip** — that is Phase 10, and it gates
sharing the app with anyone else. Until then the app is a well-tested
hypothesis.
