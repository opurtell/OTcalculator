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

Phases 0 to 9 of `IMPLEMENTATION_PLAN.md` are complete — **the app works end to
end and the §4.5 acceptance fixture renders through the real UI.**
`src/engine/` computes overtime (rate categories, the midnight ratchet,
attendance grouping, the C9.5 four-hour minimum), the tax-free N36 meal
allowance, and then the money (PAYG, HELP, pre-tax deductions, and what the
overtime added to take-home). `src/data/` holds the Annex A pay tables, ACT
public holidays, NAT 1004 coefficients, HELP thresholds, the Annex C meal
allowance and FBT caps. `src/storage/` remembers the settings across reloads, and
this pay fortnight's shifts until the fortnight ends. `src/components/` is the
app: both pathways, the shift list, the results and the working behind them.
537 tests.

Phase 9 added the polish layer — keyboard operation, touch targets, an
installable offline build, a print stylesheet, a shareable text summary, an
error boundary — but **none of it has been driven in a browser yet.** `CLAUDE.md`
lists what to try.

One thing to know about the data: tax and HELP are FY2026-27, sourced from the
ATO in August 2026 — NAT 1004 as reissued 17 June 2026, and the study-loan
thresholds as indexed for the year. The §3.8 fallback is still there for
FY2027-28, and it captions itself when it fires. FY2025-26's NAT 1004
coefficients are not held and are not reachable in the app, which resolves
settings against the current date.

Phase 10 is next, and it is the one that matters: reconcile against real
payslips with OT lines — including the `MEAL ALLOWANCE` line, whose date-prefixed
sub-rows confirm the N36 rule and settle whether 12-hour shifts earn one at all
(see §3.11). **Until it passes, this is
a well-tested hypothesis and should not be shared with colleagues.**

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

`node scripts/make-icons.mjs` redraws the app icons in `public/` from the mark
in `index.html`'s favicon. It encodes the PNGs itself rather than pulling in an
image dependency, and only needs running if the mark changes.

**The service worker only exists in a build.** `npm run dev` has none by
design — it would cache the module graph and fight HMR — so anything about
offline behaviour has to be checked through `npm run preview`.

## Layout

| Path | What it is |
| --- | --- |
| `src/engine/` | Pure calculation. No DOM, no React, no imports from `data/`, `components/` or `storage/` — that boundary is what makes the money math testable, and `__tests__/boundary.test.ts` enforces it |
| `src/data/` | Every rate, table and threshold, each with a provenance comment. The engine takes these as parameters and holds no figures of its own |
| `src/storage/` | Versioned `localStorage`. Reads never throw and never trust what they find. Two keys: settings, which are indefinite, and this pay fortnight's shifts, which are discarded when the fortnight rolls over |
| `src/ui/` | Station Ledger, the 22-component design system |
| `src/app/` | The pure app-layer logic between engine and screen: shift drafts, warnings, figure rows, the shareable summary |
| `src/components/` | The screens themselves |
| `src/App.tsx` | The app shell — the only place that reaches for `localStorage` |
| `public/` | PWA manifest and the generated icons |
| `vite.config.ts` | App build. Carries `base: '/OTcalculator/'` |
| `vite-pwa.ts` | Emits `sw.js` with the build's own asset list baked in |
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

The workflow also asserts that `dist/sw.js`, the manifest and the icons exist
and that the worker's precache list carries subpath URLs. Offline support fails
the same silent way the base path does: the app still loads over the network,
so nothing looks wrong until someone opens it with no signal.

## Documents

| Document | What it covers |
| --- | --- |
| `IMPLEMENTATION_PLAN.md` | The calculation spec (§3 is authoritative), tech design, 11 phases, risks |
| `DESIGN_BRIEF.md` | Design language, tokens, 9 screen wireframes, copy deck, accessibility |
| `NEXT_SESSION.md` | **What to do next** — Phase 10, the browser checks Phase 9 never got, and the design system |
| `.design-sync/NOTES.md` | Read before any design-sync run |
