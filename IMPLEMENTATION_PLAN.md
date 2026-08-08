# ACTAS OT Calculator — Implementation Plan

**Status:** Draft for approval
**Date:** 7 August 2026
**Target:** Static single-page app on GitHub Pages
**Sibling project:** `~/claudeCode/my-actas-pay` (ACTAS Pay Tracker) — source of the EBA reference material, pay tables and a proven pay engine. This app is a deliberately smaller, standalone tool.

---

## 1. What this app is

A fast answer to one question: **"If I pick up this overtime, what actually lands in my bank account?"**

Two pathways:

| Pathway | Input | Use |
| --- | --- | --- |
| **Quick calculation** | Hours worked, one shift | Standing in the mess room deciding whether to take a shift. Assumes Mon–Sat rates. |
| **Fortnight calculator** (primary) | Date + start/end for each OT shift, any number of shifts | Planning or checking a full fortnight of mixed incidental and full OT shifts. |

Both add the OT to the user's ordinary fortnightly pay, apply pre-tax deductions, compute PAYG withholding, and report **pre-tax income, tax, and net income for the fortnight**, plus the marginal take-home the OT actually generated.

### Explicitly out of scope for v1

Payslip upload/parsing, verification against actual payslips, leave and time-bank accrual, forecasting, accounts and sync, part-time and casual patterns, on-call/close-call allowances, HDA, meal allowances, 10/14 legacy roster. All of these live in the sibling project. If v1 succeeds, meal allowances (N36) and HDA are the two most likely additions.

### What it is not

Not payroll software, not financial advice, not an authority on what you are owed. It is an estimate built from the published EBA and ATO schedules. The disclaimer is a permanent UI element, not a splash screen.

---

## 2. Decisions already made

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Pay band selection derives both base annual and fortnightly gross from a built-in table; **both fields remain editable** | Covers HDA, part-time, ARIn and pay-table drift without forcing manual entry on the common case |
| D2 | Headline result is the **OT take-home delta**; fortnight with/without OT shown as a secondary comparison | Directly answers "was that shift worth it" |
| D3 | Tax inputs exposed: **HELP/HECS study debt** and **tax-free threshold claimed**. Medicare exemption and super display deferred | HELP is worth $60–150/fortnight at these incomes and interacts with OT; the others are rare or informational |
| D4 | Salary packaging percentage is **% of total fortnight gross including OT** | Matches the stated intent; means a heavy OT fortnight packages proportionally more |
| D5 | Static SPA, no backend, no account | GitHub Pages constraint and a genuine privacy benefit — salary data never leaves the device |

---

## 3. The pay calculation

This section is the specification. Everything else is plumbing.

### 3.1 Ordinary fortnightly pay

**Agreement status.** The ACT Public Sector ACTAS Enterprise Agreement 2023–2026 remains in effect. Its 31 March 2026 nominal expiry has passed, but no successor exists — negotiations are ongoing as at August 2026. The rates effective **4 December 2025** (1% + $1,000, clause C2.2.7) are the current and correct rates, and the Annex A tables are authoritative. Build against them without hedging.

Paramedic and ICP staff on the current 44-hour roster are paid a composite:

```
Annex A total annual  =  base + penalties (29.71% of base) + rostered OT (1.87% of base)
                      =  base × 1.3158            [EBA N25.1]

Roster adjustment     =  base × 2.20%             [EBA N44]

Ordinary fortnightly  =  (Annex A total + roster adjustment) × 12 / 313    [EBA C3.3]
```

The `12/313` divisor (not `/26`) is the EBA's own formula and gives 26.0833 fortnights per year.

**Use the published Annex A totals verbatim** rather than recomputing `base × 1.3158` — the EBA tables are rounded to whole dollars and recomputation drifts by a few dollars. Store both `base` and `total` per step.

### 3.2 Overtime rate — the number everything hangs on

```
OT hourly rate = annualBase × 12/313 × multiplier × 1/76
```

**`annualBase` is the base salary only** — not the composite total, not including the roster adjustment allowance. This is EBA N34.1 and is confirmed in the sibling engine (`lib/pay-engine/pay/ot-pickup.ts:15`, `OtPickupRequest.annualBase`). Getting this wrong inflates every result by ~34%, so it gets an explicit named constant and a test that asserts the composite is *not* applied.

`76` is the ordinary fortnightly hours (38/week × 2).

### 3.3 OT rate categories

| Category | Multiplier | When |
| --- | --- | --- |
| `mf_1_5x` | 1.5× | Mon–Fri, first 2 hours of OT in the attendance |
| `mf_2x` | 2× | Mon–Fri, after the first 2 hours |
| `sat_2x` | 2× | Saturday, all hours (N34 — Saturday is double time throughout, unlike C9.12) |
| `sun_2x` | 2× | Sunday, all hours (C9.13) |
| `ph_2_5x` | 2.5× | ACT public holiday, all hours (C9.14) |

The three 2× categories stay distinct even though they tie numerically — they display differently in the breakdown, and a future EBA may break the parity.

### 3.4 The midnight ratchet

**Once an OT attendance starts, the effective rate can only go up — never down, even across midnight.**

This is ACTAS payroll operational practice, not literal EBA text (the EBA is silent; C9.10 says each day stands alone). It is documented and confirmed in `~/claudeCode/my-actas-pay/main-plan-docs/actas_pay_tracker_ot_midnight_crossover.md`, and it materially changes results for night pickups.

Two consequences:

1. Sunday 22:00 → Monday 06:00 pays **all 8 hours at 2×**, not 2h at 2× then 2h at 1.5× then 4h at 2×.
2. The Mon–Fri "first 2 hours at 1.5×" counter is **per attendance, not per calendar day** — it does not reset at midnight. Mon 19:00 → Tue 03:00 pays 2h at 1.5× + 6h at 2×.

Algorithm: walk the attendance minute by minute, tracking the highest multiplier seen so far and a cumulative Mon–Fri minute counter. For each minute, take the calendar-implied category; if its multiplier is ≥ the highest seen, use it and update the high-water mark; otherwise carry the highest category forward. Coalesce contiguous same-category minutes into segments.

> **Two clarifications added in Phase 2**, without which the paragraph above reproduces five of the seven worked examples but mislabels §4.2 and §4.5.
>
> 1. **The Mon–Fri counter advances only while a weekday rate is actually being paid**, not on every calendar-weekday minute. In Sunday 22:00 → Monday 06:00 the Monday minutes are carried at 2×, so the counter never starts, the calendar never reaches `mf_2x`, and all eight hours stay tagged `sun_2x`. Ticking it on calendar weekdays instead relabels half the Monday as `mf_2x` — same money, but line items that no longer match payroll's, which is what Phase 10 reconciles.
> 2. **Ties genuinely go to the calendar** (`≥`, as written). The crossover doc's own reference implementation in its §6.1 uses strict `>`, which contradicts its §4.1: a Saturday running into Sunday must tag the Sunday hours `sun_2x`, not carry the Saturday label. The sibling project's shipped code uses `≥`, and `≥` plus clarification 1 is the only combination that reproduces all seven examples.
>
> Segments also break at midnight, so each describes exactly one calendar day and matches the sibling engine's per-day line items.

This is directly portable from `lib/pay-engine/pay/overtime.ts:57` (`categoriseAttendance`) with the Temporal dependency swapped out (see §4.3).

### 3.5 Attendance grouping

Shifts entered separately are separate attendances unless they are close enough to be one continuous attendance:

- Gap ≤ 60 min → same attendance (meal breaks don't break continuity, C9.7). The ratchet and the Mon–Fri counter carry across.
- Gap > 60 min → new attendance. Both reset.
- Gap between 30 and 120 min → still grouped per the rule above, but **flagged in the UI** for the user to confirm, since it's an engine convention rather than an EBA rule.

### 3.6 Minimum payment — the incidental vs full shift distinction

**EBA C9.5: where overtime is not continuous with ordinary duty, the minimum payment is 4 hours.** C9.6 extends this to OT cancelled within an hour of the start.

This is not implemented in the sibling project and is the main piece of genuinely new engine logic here. It matters: a 2-hour called-in stint pays 4 hours.

Each shift in the fortnight calculator carries a **"continuous with my rostered shift?"** toggle:

| Setting | Meaning | Minimum |
| --- | --- | --- |
| **Continuous** (shift overrun / "incidental") | OT ran on directly from rostered duty | None — paid actual hours |
| **Separate** (called in / picked up a full shift) | A distinct attendance | 4 hours (C9.5) |

Default: infer from duration — under 4 hours defaults to *continuous* (most short OT is an overrun), 4 hours or more defaults to *separate* (you don't accidentally overrun by 8 hours). Always visible and always overridable; never silently applied.

When the minimum bites, show it explicitly: `2h 15m worked → 4h paid (C9.5 minimum)`. Users should never see an unexplained number that's larger than their hours.

Top-up hours are paid at the rate of the first hour of the attendance.

The quick calculator does not model this — it states its assumption instead (§5.1).

### 3.7 Public holidays

ACT public holidays for the covered years, as static data. Sourced from the sibling project's `lib/pay-engine/reference/data/public-holidays.json`, which currently runs to mid-2027. A shift on a listed date is `ph_2_5x` for all hours.

Because the list has an end date, the app must **warn rather than silently under-pay** when a shift date falls beyond the last known holiday year.

### 3.8 PAYG withholding

Method per ATO NAT 1004 fortnightly:

```
weekly       = floor(fortnightlyTaxableGross / 2)
x            = weekly + 0.99
row          = first bracket where weekly < threshold
withholding  = max(0, round(row.rate × x − row.base))
fortnightly  = withholding × 2
```

Scale selection: tax-free threshold claimed → Scale 2; not claimed → Scale 1.

**⚠️ First task for the implementer.** The sibling project's `tax-scales.json` holds verified NAT 1004 weekly coefficients for **FY2025-26 only**. Its FY2026-27 entry is an *annual bracket stand-in* flagged "pending ATO NAT 1004 FY2026-27 publication (expected June/July 2026)". We are now in August 2026, so the real coefficients should exist.

**Task:** source the FY2026-27 NAT 1004 weekly coefficients from `softwaredevelopers.ato.gov.au` (the `NAT_1004.xlsx` workbook, Sheet 2) and verify them against a real payslip.

**If they are not yet published:** fall back to the **FY2025-26 coefficients**, not the annual-bracket stand-in. Reasons: the coefficient method is what payroll actually runs, so a one-year-stale coefficient set stays structurally correct and is wrong only by the FY2026-27 rate change (the second bracket dropping 16% → 15%); the annual-bracket approach diverges from payroll in method as well as amount. The error is a modest over-statement of tax — conservative in the right direction for someone deciding whether a shift is worth it.

When the fallback is active, the UI shows a quiet caption under the tax figure: `Using 2025–26 tax rates — 2026–27 schedule not yet published.` Remove the caption, not the fallback, once real coefficients land.

The engine keys tax data by financial year and selects on the pay date, so both years coexist, older fortnights stay correct, and swapping the fallback for real coefficients is a one-file change with no engine edit.

### 3.9 HELP / HECS

Compulsory repayments are withheld under NAT 3539, which is a separate schedule from income tax. Approach:

```
repaymentIncomeAnnual = fortnightlyTaxableGross × 26.0833
repaymentAnnual       = apply HELP threshold schedule
repaymentFortnight    = repaymentAnnual / 26.0833
```

FY2025-26 thresholds are in the sibling project (`help-thresholds.json`) using the marginal structure introduced that year. FY2026-27 thresholds are sourced alongside the tax scales as the same first task, with the same fallback rule — if the FY2026-27 schedule isn't available, use FY2025-26 thresholds and show the same caption. HELP thresholds are indexed annually, so a stale set understates the repayment slightly.

**Warn about the packaging interaction.** Salary packaging reduces the HELP withheld each fortnight, but the annual assessment adds the grossed-up fringe benefit back into repayment income. Someone packaging the full $9,010 living-expenses cap with a study debt can face a real bill at tax time. One sentence in the UI when both are active; not a modal.

### 3.10 Salary packaging and pre-tax deductions

Two inputs, usable together (D4):

```
fixedDeduction      = user-entered dollars per fortnight
percentDeduction    = percentRate × grossIncludingOt
totalPreTax         = fixedDeduction + percentDeduction
taxableGross        = grossIncludingOt − totalPreTax
```

PAYG and HELP are both computed on `taxableGross`. Net pay is `grossIncludingOt − totalPreTax − payg − help`.

Warn (don't block) when the annualised packaged amount exceeds the FBT-exempt caps — $9,010 living expenses, $2,650 meal entertainment, per `packaging.json`. These caps need an annual currency check.

Post-tax deductions are out of scope for v1; the user asked for pre-tax specifically. If added later they subtract after tax and don't affect withholding.

### 3.11 The OT delta

Run the whole calculation twice — once with OT, once without — and report the difference:

```
otGrossDelta = grossWithOt − grossWithoutOt
otNetDelta   = netWithOt − netWithoutOt
retentionPct = otNetDelta / otGrossDelta
```

The "without" run keeps the fixed pre-tax deduction constant but recomputes the percentage deduction on the smaller gross, so the comparison is internally consistent.

### 3.12 Rounding

Carry full precision through the entire calculation. Round to cents only at display. The single exception is PAYG withholding, where NAT 1004 mandates `round()` at the weekly step — that rounding is part of the specification, not a presentation choice.

### 3.13 Deliberate simplifications

Each of these is stated in the UI where it could affect a number, not buried here:

| Simplification | Effect | Why acceptable |
| --- | --- | --- |
| Wall-clock time arithmetic (no timezone/DST handling) | Twice a year, a shift crossing the DST boundary is off by one hour | C12 pays OT by hours actually worked; the app flags shifts on the two transition dates and asks the user to confirm hours |
| No super shown | Informational only | OT is not ordinary time earnings and attracts no super — noted in copy so its absence isn't a surprise |
| PAYG withholding, not annual liability | The app predicts the payslip, not the tax return | This is what the user asked for; a big OT fortnight over-withholds and comes back at tax time |
| No Medicare exemption/reduction, no MLS | Rare at these incomes | Scale 2 assumes standard Medicare, which is baked into NAT 1004 |
| C8.2 extended night penalty not modelled | N/A | Displaced by the composite for this cohort |

---

## 4. Technical design

### 4.1 Stack

| Layer | Choice | Reason |
| --- | --- | --- |
| Build | **Vite + TypeScript** | Fast, static output, first-class GitHub Pages story |
| UI | **React** (via Vite) | The fortnight shift list is genuinely dynamic; hand-rolled DOM would be worse |
| Styling | **Plain CSS with custom properties** | ~400 lines. The design brief defines tokens; no framework needed and no build coupling |
| Tests | **Vitest** | Same runner as the sibling project; the engine is pure functions and highly testable |
| Dates | **No library** | See §4.3 |
| Deps at runtime | **React + React DOM only** | Total bundle target under 100 KB gzipped |

Rejected: Next.js (static export works but the framework earns nothing here); Tailwind (faster to write, but the design brief specifies an exact token system and CSS gives cleaner control at this size); Temporal polyfill (see below).

### 4.2 Repository layout

```
OTcalculator/
├── index.html
├── vite.config.ts               base: '/OTcalculator/'   ← see §4.6
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── engine/                  pure, no DOM, no React
│   │   ├── types.ts
│   │   ├── calendar.ts          date utils, day-of-week, PH lookup, DST flags
│   │   ├── overtime.ts          ratchet categorisation + OT dollars
│   │   ├── attendance.ts        grouping + C9.5 four-hour minimum
│   │   ├── tax.ts               NAT 1004 PAYG + HELP
│   │   ├── packaging.ts         pre-tax deductions
│   │   ├── fortnight.ts         orchestrator + delta
│   │   └── __tests__/
│   ├── data/
│   │   ├── pay-rates.ts         AP1/AP2/ICP1/ICP2 × steps
│   │   ├── tax-scales.ts        NAT 1004 by FY
│   │   ├── help-thresholds.ts
│   │   └── public-holidays.ts   ACT
│   ├── storage/
│   │   └── preferences.ts       localStorage, versioned schema
│   ├── components/
│   └── styles/
│       └── tokens.css
├── .github/workflows/deploy.yml
└── README.md
```

The `engine/` directory has no imports from `components/` or `storage/` and no DOM access. That boundary is what makes the money math testable.

### 4.3 Dates without a library

The sibling project uses `@js-temporal/polyfill`, which is ~200 KB — unjustifiable for a tool whose entire point is loading fast on a phone.

Instead, represent time as two primitives:

```ts
type IsoDate = string;   // 'YYYY-MM-DD', lexicographically sortable
type Minutes = number;   // minutes since midnight, 0–1439
```

An OT shift is `{ date: IsoDate, startMin: Minutes, endMin: Minutes, endsNextDay: boolean }`.

The ratchet walk operates on integer minute offsets from the attendance start, converting to a calendar date by integer division. Day-of-week comes from `new Date(y, m-1, d).getDay()` — constructed with local components, which avoids the UTC-parsing trap of `new Date('2026-08-07')`.

No timezone conversion happens anywhere, which is correct because every time in this app is ACT wall-clock. The cost is DST, handled per §3.13.

### 4.4 Persistence

`localStorage` under a single versioned key:

```ts
{
  schemaVersion: 2,
  payBand: { classification: 'AP1', step: 2 },
  overrides: { annualBase: null, fortnightlyGross: null },
  tax: { claimsTaxFreeThreshold: true, hasStudyDebt: false },
  deductions: { fixedPerFortnight: 0, percentOfGross: 0 },
  lastPathway: 'fortnight'
}
```

Rules:
- Read is defensive — any parse failure, unknown version or schema mismatch falls back to defaults rather than throwing. A calculator that white-screens because of a stale key is worse than one that forgets your settings.
- Write on change, debounced.
- **Shift entries are not persisted by default.** They're transient by nature and persisting them creates a stale-data trap. A "keep this fortnight" opt-in is a reasonable v1.1 addition.
- A visible "Clear saved settings" control in Settings.

Cross-device transfer via a URL hash payload is a possible v1.1 addition — deliberately deferred because it's the one feature that could put salary data into a browser history or a pasted link.

### 4.5 Testing

The engine is the product; the UI is a form. Test weighting reflects that.

**Golden fixture — this is the acceptance test.** AP1 Step 2, FY2025-26 coefficients, Scale 2, no study debt, no deductions:

| Quantity | Value |
| --- | --- |
| Base annual | $95,698 |
| Annex A total annual | $125,920 |
| Roster adjustment (2.20% of base) | $2,105.36 |
| Combined annual | $128,025.36 |
| **Ordinary fortnightly gross** | **$4,908.32** |
| Ordinary hourly (base ÷ 76 fortnightly) | $48.2754 |
| OT @ 1.5× | $72.4131/h |
| OT @ 2× | $96.5508/h |
| OT @ 2.5× | $120.6885/h |

Add one Saturday 09:00–19:00 pickup (10 h @ 2× = $965.51) and one Wednesday 2-hour shift overrun (2 h @ 1.5× = $144.83):

| | Without OT | With OT |
| --- | --- | --- |
| Pre-tax | $4,908.32 | $6,018.66 |
| PAYG (Scale 2) | $1,208.00 | $1,620.00 |
| Net | $3,700.32 | $4,398.66 |

**OT delta: $1,110.34 gross → $698.34 net (62.9% retained).**

> **Correction, resolved in Phase 3.** The implemented figures are **$1,110.33 →
> $698.33**. Both line items above are exact; the totals here sum them *after*
> rounding, while §3.12 requires full precision until display. One cent, in the
> plan's favour, and accepted — but the tests assert the .33 figures and should
> not be "fixed" back. Which convention payroll actually uses is a Phase 10
> question: if a real payslip sums rounded lines, §3.12 needs an exception for
> per-line overtime.

These figures are computed from the EBA tables and the FY2025-26 NAT 1004 coefficients in the sibling project. They must be **re-verified against a real payslip in Phase 10** before the app is shared with anyone else.

Other required coverage:

- Ratchet: all seven worked examples from the sibling project's crossover doc (§4.1–§4.7), including Sun→Mon carrying at 2× and Mon 23:00→Tue 03:00 splitting 2h/2h.
- OT rate uses base, never composite — an explicit assertion.
- C9.5 minimum: 2h separate → 4h paid; 2h continuous → 2h paid; 5h separate → 5h paid.
- Attendance grouping at 30/60/90/120-minute gaps.
- Public holiday all-hours 2.5×; PH→weekday carry.
- PAYG at bracket boundaries and at zero income.
- Packaging: fixed only, percent only, both; cap warning.
- Delta consistency: zero OT ⇒ zero delta.
- Storage: corrupt JSON, unknown schema version, missing keys all fall back cleanly.

Property test worth having: OT dollars are monotonic in hours, and net pay is monotonic in gross.

### 4.6 Deployment

GitHub Actions on push to `main`: install, `vitest run`, `vite build`, publish `dist/` via `actions/deploy-pages`. **A failing test blocks the deploy.**

Two gotchas to get right on day one:

1. `vite.config.ts` needs `base: '/OTcalculator/'` — the repo serves from a subpath, and the default `/` produces a blank page with 404s on every asset. This is the single most common GitHub Pages failure.
2. Repository Settings → Pages → Source must be **GitHub Actions**, not "Deploy from a branch".

Add a `404.html` that redirects to `index.html` if client-side routing is used; simpler to use hash-based tabs and skip it.

### 4.7 Privacy and offline

No backend, no analytics, no external requests, no web fonts loaded from a CDN — system font stack or self-hosted subset only. Every number stays in `localStorage`.

A service worker with a precache manifest makes the app work with no signal — genuinely useful in an ambulance station basement. Combined with a web app manifest, it installs to the home screen and behaves like a native app. This is cheap (Vite PWA plugin) and disproportionately improves the experience.

---

## 5. The two pathways

### 5.1 Quick calculation

One number in, one number out. Inputs: hours worked (and the remembered pay band).

Assumptions, **stated on screen, not hidden**:

> Assumes a single Mon–Sat shift: first 2 hours at time and a half, the rest at double time. No public holiday or Sunday rates, no 4-hour minimum applied. For an accurate figure use the fortnight calculator.

Hours split: `min(hours, 2)` at 1.5×, remainder at 2×.

Output: OT gross, and the estimated net delta once added to the remembered ordinary fortnightly pay. If no pay band has been set yet, the pathway prompts for it first — it cannot produce a net figure without one.

### 5.2 Fortnight calculator (primary)

The core loop is *add shift → see the number move*. Every added shift updates the result immediately; there is no "Calculate" button.

Per shift: date, start time, end time, and the continuous/separate toggle (§3.6). The app derives `endsNextDay` automatically when end ≤ start, showing "ends next day" as confirmation rather than asking.

Per shift, display: hours worked, hours paid (if different), the rate-category breakdown, and dollars. A shift showing `Sun 22:00–06:00 · 8h · all at 2× (rate carried past midnight)` teaches the ratchet rule in passing.

Shifts are reorderable-by-date automatically, individually editable and deletable, and duplicable — picking up the same shift twice in a fortnight is common.

Validation, all non-blocking warnings rather than hard errors:
- Shift longer than 16 hours
- Shifts overlapping each other
- More than 14 days spanned
- Date beyond the public-holiday data horizon
- Date on a DST transition

---

## 6. Phases

Each phase ends in a working, deployed state. No phase leaves the app broken.

**Status: Phases 0–3 are complete** — scaffold, reference data, overtime engine
and money engine, with the §4.5 fixture passing end to end. Phase 4 is next.
`CLAUDE.md` carries the current detail; this table is the plan, not the record.

| # | Phase | Deliverable | Depends on |
| --- | --- | --- | --- |
| **0** | Scaffold | Vite + TS + React + Vitest, GitHub Actions deploying to Pages, "hello world" live at the real URL, base path proven correct | — |
| **1** | Reference data | **First task: source NAT 1004 FY2026-27 coefficients + HELP thresholds; if unpublished, fall back to FY2025-26 per §3.8.** Then pay tables for AP1/AP2/ICP1/ICP2 with all steps; ACT public holidays; FBT caps checked for currency | 0 |
| **2** | OT engine | `calendar.ts`, `overtime.ts`, `attendance.ts`. Ratchet, categories, C9.5 minimum, OT dollars. Full test suite green including all seven crossover fixtures | 1 |
| **3** | Money engine | `tax.ts`, `packaging.ts`, `fortnight.ts`. PAYG, HELP, pre-tax deductions, with/without-OT delta. **Golden fixture from §4.5 passes** | 2 |
| **4** | Persistence | Versioned `localStorage`, defensive reads, clear-settings control | 0 |
| **5** | Shell + setup | App frame, pathway switcher, pay band picker with editable overrides, deductions and tax panel, disclaimer | 3, 4 |
| **6** | Quick pathway | Hours input, assumption note, result | 5 |
| **7** | Fortnight pathway | Shift list, add/edit/delete/duplicate, live recalculation, warnings | 5 |
| **8** | Results | Delta headline, with/without comparison, per-shift breakdown, expandable "how this was worked out" | 6, 7 |
| **9** | Polish | Accessibility pass, mobile pass, PWA + offline, print/share, empty and error states, copy review | 8 |
| **10** | Validation | Reconcile against real payslips from `~/claudeCode/my-actas-pay/personal-payslips/` that contain OT lines. Correct any divergence. **Gate before sharing with colleagues** | 9 |

Phases 0–3 are the substance. Phases 5–8 are a form and a table.

### Phase 10 is not optional

The sibling project holds 35 real payslips. Any of them containing OT lines is a free end-to-end test of the engine against actual payroll output. Reconciling even three or four OT fortnights would catch a wrong composite, a wrong divisor, or a misread of N34.1 — the class of error that is invisible in unit tests because the tests encode the same misunderstanding.

Until Phase 10 passes, the app is a well-tested hypothesis.

---

## 7. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **NAT 1004 FY2026-27 coefficients unavailable** | Tax figures slightly overstated | Not a blocker. Fall back to FY2025-26 coefficients with a visible caption (§3.8); swap in real coefficients later as a one-file change |
| **OT computed on composite instead of base** | ~34% overstatement | Named constant, explicit test, Phase 10 payslip reconciliation |
| **A successor EBA lands during the app's life** | Rates change, usually with back-pay to a date before the agreement is signed | **Not a current risk** — the 2023–2026 agreement remains in effect past its 31 March 2026 nominal expiry and negotiations are ongoing. The 04/12/2025 rates are correct and stable. When a successor arrives: pay table is a single edit-one-file update, the UI already shows the rate effective date, and editable overrides (D1) let users apply new rates before the app is updated |
| **Midnight ratchet is convention, not EBA text** | Results may not match payroll if practice changes | Documented in the UI explanation; Phase 10 validates it against real payslips |
| **C9.5 minimum defaults guess wrong** | Over- or under-statement on short shifts | Default is inferred but always visible and overridable; the minimum is shown explicitly when applied |
| **Public holiday data runs out mid-2027** | Silent under-payment of PH shifts | Warn when a shift date exceeds the data horizon; annual data refresh noted in README |
| **User treats output as authoritative** | Real-world financial decision on an estimate | Permanent disclaimer, "estimate" wording throughout, no green ticks or confident affirmations |

---

## 8. Open questions

None blocking. Worth deciding before Phase 8:

1. Should the fortnight calculator offer a "copy result as text" for pasting into a message to a partner or a colleague? Cheap, and likely to be used.
2. Should there be a rate-effective-date selector for calculating historical fortnights, or is "current rates only" correct for v1? Leaning current-only.
3. Meal allowance (N36, $35.38/occasion) is a real cash addition to most OT shifts and is not in v1. Worth including at Phase 8 if the eligibility rules can be expressed as a simple per-shift checkbox rather than inferred.

---

## 9. Reference sources

All in the ACTAS Pay Tracker — `~/claudeCode/my-actas-pay/` locally, or
`github.com/opurtell/my-actas-pay`, which a web session can attach mid-run with
`add_repo`. The GitHub copy carries everything below **except**
`personal-payslips/`, so Phase 10 is the only item that needs the local machine.

Everything except the payslips and the ratchet implementation has now been
ported into `src/data/`; the entries below are the provenance record.

| What | Where |
| --- | --- |
| EBA pay reference (all clauses cited above) | `reference-sources/actas_pay_eba_full_reference.md` |
| Pay tables as data | `reference-sources/actas_pay_rates.json` |
| Full EBA transcription | `reference-sources/act_ambulance_service_eba_2023_2026_transcription.md` |
| Midnight ratchet rule + worked examples | `main-plan-docs/actas_pay_tracker_ot_midnight_crossover.md` |
| Ratchet implementation to port | `lib/pay-engine/pay/overtime.ts` |
| OT dollars + `annualBase` contract | `lib/pay-engine/pay/ot-pickup.ts` |
| NAT 1004 coefficients (FY2025-26 verified) | `lib/pay-engine/reference/data/tax-scales.json` |
| HELP thresholds | `lib/pay-engine/reference/data/help-thresholds.json` |
| ACT public holidays | `lib/pay-engine/reference/data/public-holidays.json` |
| FBT caps and gross-up | `lib/pay-engine/reference/data/packaging.json` |
| Real payslips for Phase 10 | `personal-payslips/` |
