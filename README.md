# ACTAS OT Calculator

Enter a fortnight's overtime shifts, get pre-tax income, PAYG tax and net
income — plus what the overtime actually added to take-home pay.

A static single-page app for ACTAS paramedics. No backend, no account, no
analytics; every figure stays in your browser's `localStorage`.

**Live:** https://opurtell.github.io/OTcalculator/

> **Estimate only.** Based on the ACTAS Enterprise Agreement 2023–2026 and ATO
> withholding schedules. Not payroll advice. Check your payslip. The
> calculation has not yet been reconciled against a real payslip — that is
> Phase 10, and it gates sharing this with anyone else.

## Status

Phases 0 and 2 of `IMPLEMENTATION_PLAN.md` are complete. The app builds, tests
and deploys, and `src/engine/` calculates overtime: rate categories, the
midnight ratchet, attendance grouping and the C9.5 four-hour minimum, under 100
tests. The screen is still the Phase 0 placeholder — nothing is wired up yet.

Phase 1 (reference data) is the blocker for everything downstream. It needs the
NAT 1004 coefficients and HELP thresholds from the ATO, ACT public holidays, and
the Annex A pay tables. The engine takes all of these as parameters and holds no
figures of its own, so Phase 3 can be built against fixtures and have the real
tables dropped in behind it.

## Working on it

```sh
npm install
npm run dev        # app at http://localhost:5173/OTcalculator/
npm test           # vitest, the engine's test suite lives here
npm run typecheck
npm run build      # app → dist/
npm run preview    # serve dist/ exactly as Pages will
```

`npm run build:lib` is a different thing: it builds the Station Ledger
component library in `src/ui/` to `dist-lib/` for the Claude Design sync. See
`.design-sync/NOTES.md` before running it.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/` | Pure calculation. No DOM, no React, no imports from `components/` or `storage/` — that boundary is what makes the money math testable, and `__tests__/boundary.test.ts` enforces it |
| `src/ui/` | Station Ledger, the 22-component design system |
| `src/App.tsx` | The app shell |
| `vite.config.ts` | App build. Carries `base: '/OTcalculator/'` |
| `vite.config.lib.ts` | Library build, output `dist-lib/` |

## Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`: typecheck, tests, build,
then publish `dist/` to GitHub Pages. **A failing test blocks the deploy.**

Two things about this that are easy to get wrong:

1. **`base: '/OTcalculator/'` in `vite.config.ts`.** Pages serves from a
   subpath; the Vite default of `/` gives a blank page with a 404 on every
   asset. The workflow asserts the built `index.html` carries subpath asset
   URLs so this cannot regress silently.
2. **Repository Settings → Pages → Source must be "GitHub Actions"**, not
   "Deploy from a branch". This is a one-time setting in the GitHub UI and the
   workflow cannot set it for you — the first deploy fails without it.

## Documents

| Document | What it covers |
| --- | --- |
| `IMPLEMENTATION_PLAN.md` | The calculation spec (§3 is authoritative), tech design, 11 phases, risks |
| `DESIGN_BRIEF.md` | Design language, tokens, 9 screen wireframes, copy deck, accessibility |
| `NEXT_SESSION.md` | Remaining design-system work |
| `.design-sync/NOTES.md` | Read before any design-sync run |
