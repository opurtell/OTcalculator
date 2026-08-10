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
| **5** Shell + setup | **Done.** `src/components/` + `src/app/` — app frame, pathway switcher, pay band picker with editable overrides, deductions and tax panel, disclaimer, clear-settings. `App.tsx` wires the calculator to persistence |
| **6** Quick pathway | **Done.** One hours field, the §5.1 two-tier split, the low-estimate note. Adds `quickOvertime` and the behaviour-preserving `comparePay` extraction in `src/engine/` |
| **7** Fortnight pathway | **Done.** Shift list, add/edit sheet with live preview, delete-with-undo, duplicate, the roster quick-fill, and the five non-blocking warnings. A row is an attendance, not an entry |
| **8** Results | **Done.** The with/without comparison table, an inspectable per-shift Overtime breakdown, the tax-free meal allowance line and its per-occasion derivation, and the §5.7 "how this was worked out" disclosure. Row logic lives in `src/app/breakdown.ts`; `HowItWasWorkedOut.tsx` wraps the §5.7 derivation |
| **9** Polish | **Done; verified in a browser at desktop width only.** Keyboard operation of the tabs and segmented control, the tab panel, a narrowed live region, Escape and focus return on the sheet and row menu; 44px targets, 16px inputs, a capped sticky result on desktop, safe areas; PWA with a hand-rolled service worker; print stylesheet and a shareable text summary; an error boundary and the settings-repair notice; a copy sweep against the §6 deck |
| **10** Validation | **Not started, and it is the gate.** Reconcile against the 35 payslips in the sibling repo. Needs the local machine — they are deliberately not on GitHub. Method in `NEXT_SESSION.md` |

`calculateFortnight(shifts, settings)` in `src/engine/fortnight.ts` is the entry
point — shifts and settings in, take-home and the overtime delta out. It calls
`calculateOvertime` underneath, which is usable alone if you only want gross OT.
533 tests. All seven crossover worked examples pass. Four things to know:

- **The meal allowance is the one untaxed figure, and it sits outside
  `PayComparison` deliberately.** `src/engine/meals.ts` prices EBA N36 — $35.38
  per occasion from Annex C, one per N36.3 meal period the *duty* worked through,
  and only where overtime ran past the end of a rostered shift — and
  `calculateFortnight` adds it *after* PAYG. It is never in `gross`,
  `taxableGross` or `net`; `netTotal`, `otEarnedTotal` and `otNetTotal` are where
  it lands. Folding it into gross would have tax withheld on it, which is the one
  thing that must not happen. See "The meal allowance" below — the rule was
  re-derived once already and the first reading was inverted.
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

## The meal allowance

`src/engine/meals.ts` prices the overtime meal allowance. **$35.38 per occasion**
(Annex C, the 1.93% column effective 4 December 2025), with the whole C20.2
progression in `src/data/allowances.ts`, looked up by pay date. Whether one is
owed is **N36**, not Annex C — and the two phrases in N36.2 that decide it are
both easy to read past:

> ... where the overtime is worked **after the end of ordinary duty for the day**,
> **to the completion of or beyond a meal period**, and any subsequent meal
> period, without a break for a meal.

**The first is a gate.** The overtime has to sit past the end of a shift, so a
shift worked and knocked off on time earns nothing. **The second describes the
duty, not the overtime alone** — you worked through a meal period without a
break, *and* you did not get to go home on time. Attaching it to the overtime
alone makes the clause fire only on 2–4 hour overruns, which is not the case it
was written for.

So `dutyFor` places the N36.2 boundary from the roster patterns, and there is no
calculation at all without one:

- **`overrun`** → the pattern whose **end** time is the overtime's start. The
  shift is reconstructed backwards from the boundary, which is what puts the
  shift's own meal periods inside the duty.
- **`separate`** → the pattern whose **start** time is the attendance's start: a
  picked-up shift entered as one period. The boundary is that pattern's end, and
  the attendance has to run past it. `06:30–16:30` earns nothing; `06:30–16:31`
  earns.
- **Neither → nothing, silently.** Oscar's call. Guessing a boundary from an
  unrecognised time would invent the one fact the clause turns on.

Then one allowance per N36.3 window (**midnight–01:00, 07:00–09:00, 12:00–14:00,
18:00–19:00**) the duty worked inside, was still running at the close of, and had
no unpaid break in.

Eight things about it, and most of them are easy to break:

- **`MEAL_PERIODS` is not N35.7.** The Windows of Opportunity — when a break is
  *scheduled* — are AM 0930–1130, D 1200–1400 & 1700–1900, PM 1400–1600 &
  1900–2200, N 0000–0200. The D shift's 1700–1900 break window against its
  1800–1900 meal period is the near-miss that makes these two easy to conflate.
- **It is added after tax, and that is the whole point.** `mealAllowance` sits
  outside `PayComparison` so nothing in the tax path can see it. If you find
  yourself adding it to `gross` to make a total balance, the total is wrong, not
  the structure.
- **The count is the least certain part of the reading.** One per window means any
  overrun on an AM, D or PM shift earns two and on an N shift one — so a
  30-minute overrun earns $70.76, which is generous. **This is the sharpest
  Phase 10 question.** Payroll may pay one per occurrence, or require a minimum
  overrun.
- **It assumes no break was taken during the rostered shift.** On an overrun the
  shift is never entered, so there is nothing to go on, and the missed break is
  the case N36 exists for. Breaks the app *can* see — an unpaid gap inside one
  attendance, C9.7 — do suppress their own window. Both assumptions are stated in
  the §5.7 working.
- **`roster-shifts.ts` is now load-bearing for money.** It began as a shift-sheet
  quick-fill; the engine takes it as `meals.rosterShifts`. A mistyped time there
  silently removes someone's allowance, and the four **end** times must stay
  distinct from each other or an overrun cannot be attributed.
- **21:00 is the one collision, and `kind` resolves it.** It is both the D
  shift's end and the N shift's start. An overrun there ran on from a D; a
  separate attendance there is a picked-up N.
- **The C9.5 top-up is money, not time on the road.** A 90-minute call-in from
  the AM start pays four hours and still never reaches 16:30. Pricing off
  `paidMinutes` rather than the segments would carry a duty past a boundary it
  never worked to.
- **Late meal (O13/P15) and spoilt meal (O14/P16) do not apply to this cohort.**
  Sections O and P; N43.1 lists what the 44-hour roster substitutes, and "spoilt"
  appears nowhere in Section N. The note at the bottom of `src/data/allowances.ts`
  exists so nobody adds them from a table of contents.

**Reading A was shipped first and was wrong in both directions** — every
standalone 10-hour pickup earned two occasions, no overrun under two hours earned
any. What made it look defensible is that **N37's cross-references are off by
one**: the 10/14 section is the same text at +23 (N12↔N35, N13↔N36, N14↔N37), and
N14.1/N14.2 cite N12.3/N12 — the meal *break* clauses — where N37.1/N37.2 say
N36.3/N36. Read as written N37.2 is nearly tautological. History in
`IMPLEMENTATION_PLAN.md` §3.11; do not re-derive the extension from N37.2.

One transcription trap in the rate table: **the C20.2 increases compound on the
unrounded figure, not the printed one.** Applying the percentages to each
published dollar amount in turn gives $33.06 where Annex C prints $33.05, and the
cent carries forward. `reference-data.test.ts` holds the whole chain to the right
rule, which is what a future row should be checked against.

The engine local is named `mealWindow` rather than `window` on purpose:
`boundary.test.ts` greps the engine sources for `window.` to prove nothing there
reached for the browser, and a local of that name is indistinguishable from the
global to a regex.

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
  scrolls within itself rather than hiding its own bottom.

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

7. **The meal allowance turns on the shift the overtime attaches to, not on the
   overtime's length.** EBA N36.2 needs overtime worked *after the end of
   ordinary duty for the day*, so a pickup knocked off on time earns nothing
   while a thirty-minute overrun can earn two occasions. Three ways to get this
   wrong: dropping the shift-kind gate (which pays every standalone pickup),
   testing the overtime's own span against the meal period instead of the whole
   duty's (which pays almost no overrun), and adding the allowance to `gross`
   (which withholds tax on a tax-free figure). The first two were shipped once —
   see "The meal allowance" above.

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
omission: the Saturday pickup finishes before the D shift's rostered end, and the
Wednesday overrun starts at a time no roster shift ends at. The allowance case is
covered separately in `golden.test.ts` by an AM picked up and entered as
`06:30–18:00` — two occasions, $70.76 untaxed, PAYG unaffected. The same shift
entered as `06:30–16:30` earns nothing.

It is computed from the EBA tables and the FY2025-26 coefficients, and is
**not yet verified against a real payslip** — that is Phase 10, and it gates
sharing the app with anyone else. Until then the app is a well-tested
hypothesis.
