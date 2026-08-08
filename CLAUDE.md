# ACTAS OT Calculator

A static single-page app for ACTAS paramedics: enter a fortnight's overtime shifts, get pre-tax income, PAYG tax, and net income — plus what the OT actually added to take-home. Deployed to GitHub Pages. No backend, no account, settings in `localStorage`.

## Status

**Phases 0–8 complete — the engine, persistence, both calculator pathways, and
the results display are done and wired together. `App.tsx` connects the
persistence layer to the calculator's choices seam; the §4.5 golden fixture now
renders end to end through the real UI, with the with/without comparison,
per-shift breakdown, and the §5.7 "how this was worked out" derivation.**

Phases against `IMPLEMENTATION_PLAN.md` §6:

| Phase | State |
| --- | --- |
| **0** Scaffold | **Done.** `src/main.tsx`, `src/App.tsx` (a deliberate placeholder — no figures), `.github/workflows/deploy.yml`, live at https://opurtell.github.io/OTcalculator/ |
| **1** Reference data | **Done, with one caveat.** `src/data/` — Annex A tables, ACT holidays, NAT 1004, HELP, FBT caps. Tax and HELP are FY2025-26 only and fall back per §3.8. See "Reference data" below |
| **2** OT engine | **Done.** `src/engine/` — ratchet, categories, attendance grouping, C9.5 minimum, OT dollars |
| **3** Money engine | **Done.** `tax.ts`, `packaging.ts`, `fortnight.ts` — PAYG, HELP, pre-tax deductions, the with/without-OT delta. **The §4.5 golden fixture passes end to end** |
| **4** Persistence | **Done.** `src/storage/preferences.ts` — versioned `localStorage` per §4.4, defensive reads, debounced writes, clear-settings |
| **5** Shell + setup | **Done.** `src/components/` + `src/app/` — app frame, pathway switcher, pay band picker with editable overrides, deductions and tax panel, disclaimer, clear-settings. `App.tsx` wires the calculator to persistence |
| **6** Quick pathway | **Done.** One hours field, the §5.1 two-tier split, the low-estimate note. Adds `quickOvertime` and the behaviour-preserving `comparePay` extraction in `src/engine/` |
| **7** Fortnight pathway | **Done.** Shift list, add/edit sheet with live preview, delete-with-undo, duplicate, and the five non-blocking warnings. A row is an attendance, not an entry |
| **8** Results | **Done.** The with/without comparison table, an inspectable per-shift Overtime breakdown, and the §5.7 "how this was worked out" disclosure. Row logic lives in `src/app/breakdown.ts`; `HowItWasWorkedOut.tsx` wraps the §5.7 derivation |
| 9–10 | Not started |

`calculateFortnight(shifts, settings)` in `src/engine/fortnight.ts` is the entry
point — shifts and settings in, take-home and the overtime delta out. It calls
`calculateOvertime` underneath, which is usable alone if you only want gross OT.
329 tests. All seven crossover worked examples pass. Three things to know:

- **The §4.5 golden total is a cent adrift**, and it is the plan that is out.
  See `src/engine/__tests__/golden.test.ts` — §3.12 says full precision until
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
  did enter. `readPreferences` reports `'repaired'` when that happened — worth
  a quiet line on the settings screen rather than silently resetting a figure.
- **Shift entries are deliberately not persisted.** Last fortnight's overtime
  reappearing in this fortnight's total is the stale-data trap §4.4 refuses. A
  "keep this fortnight" opt-in is v1.1, not a default.
- **Writes are debounced, and `flush()` is wired to `pagehide` in `App.tsx`.**
  Without it the last edit is lost when a tab closes inside the delay window,
  and `pagehide` is the event that fires on mobile Safari where `beforeunload`
  does not.

Storage validates shape, not meaning: a stored band of `AP9 Step 99` round
trips, because `payBandFor` already returns `undefined` for stale settings and
duplicating Annex A behind a browser API would be the worse coupling.

`src/ui/` is the Station Ledger component library — 22 components covering the
nine screens, React the only runtime dep. It is pushed to the Claude Design
project `ACTAS OT Calculator` (`d6df1004-e7c3-46f0-835a-8719984bd989`) so the
design agent composes with the real components. Render check clean at 22/22 with
zero warns; all 22 components have authored preview cards graded good.

**There are two Vite configs and mixing them up wastes a session.**
`vite.config.ts` is the *app* build (`base: '/OTcalculator/'`, output `dist/`).
`vite.config.lib.ts` is the *library* build for the design sync (output
`dist-lib/`, `npm run build:lib`). `package.json` still carries the library's
`name`, `exports` and `peerDependencies` — that metadata describes `dist-lib/`,
not the app.

Remaining design work is in `NEXT_SESSION.md`; it needs a browser and cannot be
done from Claude Code.

## Read these first

| Document | What it covers |
| --- | --- |
| `IMPLEMENTATION_PLAN.md` | The calculation spec (§3 is authoritative), tech design, 11 phases, risks |
| `README.md` | Commands, layout, and the two deploy settings that are easy to get wrong |
| `DESIGN_BRIEF.md` | Design language, tokens, 9 screen wireframes, copy deck, a11y |
| `NEXT_SESSION.md` | What's left on the design system, and how to pick it up |
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

The engine takes all of it as **parameters** — `PayBand`, `TaxScale`,
`HolidayCalendar` — and holds no figures of its own beyond the EBA's structural
constants (76 fortnightly hours, the `12/313` divisor, the rate multipliers).
The arrow runs one way, `data/` → `engine/` types only, and
`src/engine/__tests__/boundary.test.ts` enforces it. That is what lets a
fortnight from an earlier financial year keep computing against the figures
that were current when it was worked.

**Tax and HELP are FY2025-26 only.** The ATO reissued Schedule 1 for FY2026-27
(second bracket 16% → 15%) but those coefficients are not in the sibling repo
and cannot be fetched from a web session. `taxScaleFor` and `helpScheduleFor`
fall back to FY2025-26 per §3.8 and report `isFallback` so the UI can caption
it. Adding the real rows to `src/data/tax-scales.ts` is the entire fix — no
engine change. Remove the caption, never the fallback.

Confirmed against source while porting: AP1 Step 2 is $95,698 base / $125,920
Annex A total, and the FY2025-26 Scale 2 coefficients reproduce the §4.5 PAYG
figures ($1,208 and $1,620) exactly.

## Five things that will bite

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

It is computed from the EBA tables and the FY2025-26 coefficients, and is
**not yet verified against a real payslip** — that is Phase 10, and it gates
sharing the app with anyone else. Until then the app is a well-tested
hypothesis.
