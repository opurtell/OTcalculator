# ACTAS OT Calculator

A static single-page app for ACTAS paramedics: enter a fortnight's overtime shifts, get pre-tax income, PAYG tax, and net income — plus what the OT actually added to take-home. Deployed to GitHub Pages. No backend, no account, settings in `localStorage`.

## Status

**Planning complete, nothing built yet.** Next action is Phase 0 (scaffold + deploy pipeline). Not yet a git repository.

## Read these first

| Document | What it covers |
| --- | --- |
| `IMPLEMENTATION_PLAN.md` | The calculation spec (§3 is authoritative), tech design, 11 phases, risks |
| `DESIGN_BRIEF.md` | Design language, tokens, 9 screen wireframes, copy deck, a11y |

§3 of the plan is the product. Everything else is plumbing around it.

## Sibling project — read, don't depend on

`~/claudeCode/my-actas-pay` (note the hyphens) is the ACTAS Pay Tracker: a Next.js/Cloudflare app that verifies real payslips. It holds the EBA transcription, Annex A pay tables, a tested pay engine, verified ATO NAT 1004 coefficients, ACT public holidays, and 35 real payslips.

**Port code from it; never add it as a dependency.** This app is zero-dependency and static; that one is a full stack app. Full source index in `IMPLEMENTATION_PLAN.md` §9.

## Three things that will bite

1. **Overtime is calculated on base salary only** — EBA N34.1, never the composite-inclusive Annex A total. AP1 Step 2 is $95,698, not $125,920. Getting this wrong overstates every result by ~34%. Needs a named constant and an explicit test.

2. **The midnight ratchet.** Once an OT attendance starts the rate only goes up, never down, even across midnight — and the Mon–Fri "first 2 hours at 1.5×" counter does not reset at midnight. This is ACTAS payroll convention, not EBA text. Rule and seven worked examples: `~/claudeCode/my-actas-pay/main-plan-docs/actas_pay_tracker_ot_midnight_crossover.md`.

3. **`vite.config.ts` needs `base: '/OTcalculator/'`.** GitHub Pages serves from a subpath; the default `/` produces a blank page with 404s on every asset.

## EBA status

The ACTAS Enterprise Agreement 2023–2026 **remains in effect**. Its 31 March 2026 nominal expiry has passed but no successor exists — negotiations ongoing as at August 2026. The 4 December 2025 rates are current and authoritative. Build against them without hedging about currency. Oscar will say when a successor is signed.

## Conventions

- The `src/engine/` directory is pure functions — no DOM, no React, no imports from `components/` or `storage/`. That boundary is what makes the money math testable.
- Full precision through the calculation; round to cents only at display. The one exception is PAYG withholding, where NAT 1004 mandates rounding at the weekly step.
- Dates are `IsoDate` strings (`'YYYY-MM-DD'`) and `Minutes` integers (0–1439). No date library — the Temporal polyfill is ~200KB and every time in this app is ACT wall-clock.
- Never show an unexplained figure. If the app pays 4 hours for 2 hours worked, it says why on the same line.

## Acceptance test

The golden fixture in `IMPLEMENTATION_PLAN.md` §4.5 (AP1 Step 2, one Saturday 10h pickup + one Wednesday 2h overrun → $1,110.34 gross OT becomes $698.34 net) is the acceptance test for the engine. It is computed from the EBA tables, **not yet verified against a real payslip** — that is Phase 10, and it gates sharing the app with anyone else.
