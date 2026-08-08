# ACTAS OT Calculator

A static single-page app for ACTAS paramedics: enter a fortnight's overtime shifts, get pre-tax income, PAYG tax, and net income — plus what the OT actually added to take-home. Deployed to GitHub Pages. No backend, no account, settings in `localStorage`.

## Status

**Phases 0 and 2 complete. Phase 1 is blocked on reference data; Phase 3 is next.**

Phases against `IMPLEMENTATION_PLAN.md` §6:

| Phase | State |
| --- | --- |
| **0** Scaffold | **Done.** `src/main.tsx`, `src/App.tsx` (a deliberate placeholder — no figures), `.github/workflows/deploy.yml`, live at https://opurtell.github.io/OTcalculator/ |
| **1** Reference data | **Not started.** Needs the ATO NAT 1004 coefficients, HELP thresholds, ACT public holidays and the full Annex A tables. See "Reference data" below |
| **2** OT engine | **Done.** `src/engine/` — ratchet, categories, attendance grouping, C9.5 minimum, OT dollars. 100 tests green |
| **3** Money engine | **Next.** `tax.ts`, `packaging.ts`, `fortnight.ts`. Needs Phase 1 data to finish, but the structure does not |
| 4–10 | Not started |

`calculateOvertime(shifts, band, holidays)` in `src/engine/attendance.ts` is the
Phase 2 entry point. Two gaps to know about:

- **Five of the seven ratchet worked examples are untested** — they live in the
  sibling repo's crossover doc. The two quoted in §3.4 are covered, along with
  several cases derived from the rule.
- **The §4.5 golden total is a cent adrift**, and it is the plan that is out.
  See `src/engine/__tests__/golden.test.ts` — §3.12 says full precision until
  display, which gives $1,110.33; §4.5 prints $1,110.34, the sum of the two
  already-rounded lines. Both line items are exact. Phase 10 settles it.

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

**It is only on Oscar's local machine.** Claude Code on the web clones this
repo alone, so in a remote session the sibling is simply absent — check before
planning around it. What that blocks, and what it does not:

- **Blocked:** Phase 10 (the 35 payslips), and the five remaining worked
  examples from the crossover doc. Two of the seven are quoted in full in
  `IMPLEMENTATION_PLAN.md` §3.4, so the ratchet is still testable.
- **Not blocked:** the engine. §3.4–§3.6 specify the ratchet, the grouping and
  the C9.5 minimum in enough detail to write fresh — and §3.6 has no
  counterpart in the sibling project at all.
- **Sourceable elsewhere:** the ATO data was never meant to come from the
  sibling. §3.8 sends you to `softwaredevelopers.ato.gov.au` for NAT 1004.

## Reference data

`src/data/` is unwritten and Phase 2 does not wait for it. The engine takes
every rate, table and threshold as a **parameter** — `PayBand`, `TaxScale`,
`HolidayCalendar` — and holds no figures of its own beyond the EBA's structural
constants (76 fortnightly hours, the `12/313` divisor, the rate multipliers).

That is not only a Phase 1 workaround. It is what lets a fortnight from last
financial year keep computing against last year's coefficients, and it makes
dropping in the real NAT 1004 numbers a one-file change with no engine edit.
Tests supply the §4.5 AP1 Step 2 fixture directly.

## Four things that will bite

1. **Overtime is calculated on base salary only** — EBA N34.1, never the composite-inclusive Annex A total. AP1 Step 2 is $95,698, not $125,920. Getting this wrong overstates every result by ~34%. Needs a named constant and an explicit test.

2. **The midnight ratchet.** Once an OT attendance starts the rate only goes up, never down, even across midnight — and the Mon–Fri "first 2 hours at 1.5×" counter does not reset at midnight. This is ACTAS payroll convention, not EBA text. Rule and seven worked examples: `~/claudeCode/my-actas-pay/main-plan-docs/actas_pay_tracker_ot_midnight_crossover.md`.

3. **The 4-hour minimum is for standalone shifts only.** EBA C9.5 applies when
   OT is *not* continuous with ordinary duty — a called-in or picked-up shift.
   A shift overrun never attracts it: you have already worked your rostered
   hours, so the OT is paid at actual duration however short. Oscar confirmed
   this is how every case he will enter behaves. Never top up an overrun.

4. **`vite.config.ts` carries `base: '/OTcalculator/'`.** GitHub Pages serves
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

The golden fixture in `IMPLEMENTATION_PLAN.md` §4.5 (AP1 Step 2, one Saturday 10h pickup + one Wednesday 2h overrun → $1,110.34 gross OT becomes $698.34 net) is the acceptance test for the engine. It is computed from the EBA tables, **not yet verified against a real payslip** — that is Phase 10, and it gates sharing the app with anyone else.
