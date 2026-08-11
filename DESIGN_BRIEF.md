# ACTAS OT Calculator — Design Brief

**For:** Producing mockups before implementation begins
**Date:** 7 August 2026
**Companion:** `IMPLEMENTATION_PLAN.md` (calculation rules, phases, technical decisions)

---

## 1. The one-sentence brief

A paramedic is offered a shift. They open this on their phone, and in under ten seconds they know what it puts in their bank account.

Everything in this document serves that sentence.

---

## 2. Who is using it, and where

Not at a desk. On a phone, one-handed, somewhere between a station kitchen and the back of a truck — often with a supervisor waiting on an answer. Sometimes tired, sometimes at 3am, occasionally with a partner on the phone asking whether the shift is worth it.

Design consequences:

- **Mobile-first is not a courtesy, it is the primary case.** Design the phone layout first and let desktop be the generous version, not the reverse.
- **Tap targets are large.** 44px minimum, and the primary actions are in thumb reach at the bottom of the viewport, not the top.
- **The answer is legible at arm's length.** The headline number should be readable without focusing carefully.
- **Nothing requires reading to use.** Explanations are available on demand and never in the way.
- **It works offline.** Station basements have no signal, and the UI should never show a loading state that depends on a network.

Secondary case: the same person at home on a laptop, planning a fortnight and checking the maths. That layout can afford density and a visible breakdown.

---

## 3. Design language: "Station Ledger"

The sibling ACTAS Pay Tracker uses a language called *Clinical Reconciliation* — calm, document-led, built for careful review. This app is related but has a different job: it is a **fast decision tool**, not a review workspace.

So: **the same palette and typographic family, tuned for speed and a single decisive moment.**

| | Pay Tracker (sibling) | OT Calculator (this app) |
| --- | --- | --- |
| Job | Verify and review | Decide, quickly |
| Density | Auditable, dense | Sparse, one thing at a time |
| Rhythm | Scan a table | Land on a number |
| Emphasis | Discrepancies | The result |

They should look like they came from the same organisation. They should not look like the same product.

### Principles

1. **The number is the interface.** Everything else is input to it or explanation of it. When in doubt, make the result bigger and the controls quieter.
2. **Never show an unexplained figure.** If the app pays 4 hours for 2 hours worked, it says why, on the same line. Money that appears without reason destroys trust faster than money that's wrong.
3. **Estimate, not verdict.** No green ticks, no "you'll earn", no celebration. The tone is a competent colleague doing the sums on the back of a handover sheet, not an app congratulating you.
4. **Quiet chrome, loud result.** Restrained borders, no gradients, no shadows deeper than a hairline. The only visually loud element on any screen is the answer.
5. **Progressive disclosure, honestly labelled.** Advanced settings collapse, but the collapsed summary states what's active — `Deductions: $611 + 5% · Study debt on`, never just `Advanced ▸`.

### Explicitly avoid

Gradients. Card shadows. Illustrations. Confetti or celebration states. Progress rings. Finance-app green-up-arrows. Emoji in the interface. Marketing language. Anything that makes a payslip estimate feel like a game.

---

## 4. Visual system

### 4.1 Colour tokens

Inherited from the sibling project so the two feel related. Values are the starting reference, not sacred.

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Page background | `--paper` | `#f5f7f5` | `#0d151b` |
| Content surface | `--surface` | `#ffffff` | `#141f27` |
| Raised surface (result panel) | `--surface-raised` | `#ffffff` | `#1a2831` |
| Primary text | `--ink` | `#172731` | `#e8eef1` |
| Supporting text | `--muted` | `#60727c` | `#94a6b0` |
| Borders and rules | `--line` | `#d5dfe1` | `#2a3a45` |
| Primary action / selection | `--teal` | `#176b6b` | `#3d9b9b` |
| Positive figure (money gained) | `--green` | `#25704d` | `#4fa87b` |
| Warning / assumption / review | `--amber` | `#9a6413` | `#d19a3f` |
| Deduction / tax / money out | `--red` | `#a04b3e` | `#c97a6c` |

**Dark mode is required, not a stretch goal.** A 3am shift offer is a real use case and a white screen at full brightness in a dark room is genuinely unpleasant. Mock both.

Colour rules:

- Colour never carries meaning alone. Every coloured state pairs with a label, an icon, or structure.
- `--red` is for *money leaving* (tax, deductions), never for error or alarm. This app has no alarming states.
- `--green` is for the net result only. Don't spend it elsewhere or it stops meaning anything.
- `--amber` marks assumptions and things worth confirming, not problems.

### 4.2 Typography

| Use | Family | Notes |
| --- | --- | --- |
| Interface, labels, copy | Inter, or system sans stack | Self-hosted subset or system fonts — **no CDN** (offline requirement) |
| All money, hours, percentages | IBM Plex Mono, or a tabular monospace | Tabular figures are mandatory so digits don't shift as numbers update live |

Scale (mobile → desktop):

| Element | Size | Weight |
| --- | --- | --- |
| Headline result | 40 → 52px | 600, mono, tabular |
| Headline supporting line | 15 → 16px | 400 |
| Section heading | 17 → 19px | 600 |
| Body / labels | 15 → 15px | 400 |
| Table figures | 15 → 16px | 400, mono |
| Caption / assumption note | 13 → 13px | 400 |

Money formatting: `$4,908.32` — always two decimals, always a thousands separator, always right-aligned in columns. Hours: `10h`, `2h 15m` — never decimal hours in the interface (`2.25h` is harder to read at a glance than `2h 15m`), even though the engine works in decimals.

### 4.3 Surfaces and shape

- Radii: `4px` on inputs and buttons, `8px` on panels, `12px` on the result panel only.
- Borders: `1px` hairlines in `--line` are the primary organising device.
- Elevation: essentially none. The result panel may use a `1px` border plus a barely-there `0 1px 2px rgba(0,0,0,0.04)`. Nothing else gets a shadow.
- Spacing scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`.
- Max content width on desktop: `720px` for the calculator column. This is not a dashboard; resist the urge to fill a 1440px screen.

---

## 5. Screens to mock

Nine mockups. Six are essential.

### 5.1 First run / setup — **essential**

The only screen a new user must complete. Everything else is optional.

```
┌─────────────────────────────────────┐
│  ACTAS OT Calculator                │
│                                     │
│  Set your pay band                  │
│  We'll remember it on this device.  │
│                                     │
│  Classification                     │
│  ┌─────────────────────────────┐    │
│  │ Ambulance Paramedic 1     ▾ │    │
│  └─────────────────────────────┘    │
│                                     │
│  Step                               │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐            │
│  │ 1 │ │ 2 │ │ 3 │ │ 4 │            │
│  └───┘ └▓▓▓┘ └───┘ └───┘            │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Base annual      $95,698    │    │
│  │ Fortnightly    $4,908.32    │    │
│  │                             │    │
│  │ Rates effective 04/12/2025  │    │
│  │ Doesn't match your payslip? │    │
│  │ Enter your own figures →    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Continue             │    │
│  └─────────────────────────────┘    │
│                                     │
│  Nothing you enter leaves this      │
│  device. There's no account.        │
└─────────────────────────────────────┘
```

Notes: step as segmented buttons, not a dropdown — there are only 3–4 and they're a single tap. The derived figures panel is read-only until "Enter your own figures" is tapped, at which point both become inputs with a small ✎ marker showing they're overridden.

The privacy line is not fine print. It's a feature and it sits in normal body text.

### 5.2 Quick calculation — **essential**

```
┌─────────────────────────────────────┐
│  ← Quick    │    Fortnight          │
│  ═══════════                        │
│                                     │
│  How many hours?                    │
│  ┌─────────────────────────────┐    │
│  │  10                       h │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Adds about                 │    │
│  │                             │    │
│  │    $ 6 1 2 . 4 0            │    │
│  │    take-home                │    │
│  │                             │    │
│  │  from $965.51 before tax    │    │
│  │  63% kept                   │    │
│  └─────────────────────────────┘    │
│                                     │
│  ⚠ Rough estimate. Assumes one      │
│    Mon–Fri shift: 2h at time and    │
│    a half, then double time. No     │
│    Saturday, Sunday, public holiday │
│    or 4-hour minimum applied.       │
│                                     │
│    No meal allowance either. That   │
│    depends on the times the shift   │
│    ran, not on how many hours.      │
│                                     │
│    Use the fortnight calculator     │
│    for an accurate figure. →        │
│                                     │
│  AP1 Step 2 · Study debt off        │
│  Change ▸                           │
└─────────────────────────────────────┘
```

Notes: the result appears the moment a number is typed — no button. The word "about" in the label is doing real work; keep it. The assumption block is amber-ruled on the left edge, always expanded, never dismissible.

### 5.3 Fortnight calculator — empty state — **essential**

```
┌─────────────────────────────────────┐
│  Quick     │    Fortnight ←         │
│                ═══════════          │
│                                     │
│  Your fortnight                     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Base pay        $4,908.32   │    │
│  │ AP1 Step 2 · 44hr roster    │    │
│  └─────────────────────────────┘    │
│                                     │
│  Overtime shifts                    │
│                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐      │
│                                     │
│  │   No shifts added yet.      │    │
│      Add one to see what it         │
│  │   pays.                     │    │
│                                     │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      + Add OT shift         │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 5.4 Fortnight calculator — populated — **essential, the most important mockup**

This is where the product lives. It must show a genuinely mixed fortnight.

```
┌─────────────────────────────────────┐
│  Quick     │    Fortnight           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  Your OT adds               │    │
│  │                             │    │
│  │    $ 6 9 8 . 3 3            │    │
│  │    take-home                │    │
│  │                             │    │
│  │  from $1,110.33 before tax  │    │
│  │  63% kept                   │    │
│  ├─────────────────────────────┤    │
│  │  Fortnight   no OT   with   │    │
│  │  Pre-tax    4,908.32  6,018.66  │
│  │  PAYG tax  −1,208.00 −1,620.00  │
│  │  Take-home  3,700.32  4,398.66  │
│  │  Meal allow.       —      35.38 │
│  │  ─────────────────────────  │    │
│  │  In the hand 3,700.32 4,434.04  │
│  │                             │    │
│  │  How this was worked out ▸  │    │
│  └─────────────────────────────┘    │
│                                     │
│  Overtime shifts              2     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Sat 15 Aug   09:00–19:00    │    │
│  │ 10h · all at 2×             │    │
│  │ Separate shift      $965.51 │    │
│  ├─────────────────────────────┤    │
│  │ Wed 19 Aug   16:30–18:00    │    │
│  │ 1.5h · all at 1.5×          │    │
│  │ · + $35.38 meal allowance   │    │
│  │ Shift overrun       $108.62 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │      + Add OT shift         │    │
│  └─────────────────────────────┘    │
│                                     │
│  Deductions & tax                   │
│  None · Study debt off       ▸      │
└─────────────────────────────────────┘
```

Design notes:

- **The result panel sits at the top and scrolls with the page.** It was sticky on mobile at first, on the theory that watching the number move as shifts are added is the whole point — but pinned over a single column it overlaps the fields underneath it, and the overlap is what you notice. It pins only in the desktop layout, where it has a column of its own.
- Shift rows are tappable to edit, swipe-to-delete on mobile, with a duplicate action in the row menu.
- The rate breakdown line (`10h · all at 2×`) is where the app teaches the EBA rules without a tutorial. It also carries the meal allowance when the shift earned one — beside the rate breakdown, never folded into the row's amount, because the row's amount is overtime pay and the payslip lists the allowance on its own line.
- **The comparison table has two bottom lines now**, and the order is an argument: `Take-home` is what the tax lines add up to, `Meal allowance` sits below them because it is untaxed, and `Total in the hand` is what lands. Printed above PAYG, the allowance would read as an amount tax took a cut of.
- `Separate shift` / `Shift overrun` is the C9.5 toggle rendered as a status. It must be visible in the collapsed row because it changes the money.
- The number transition when a shift is added should be a fast fade or count, ~200ms. Long enough to notice the change, short enough not to be waited on.

### 5.5 Add / edit shift — **essential**

Presented as a bottom sheet on mobile, an inline panel on desktop.

```
┌─────────────────────────────────────┐
│  Add OT shift                    ✕  │
│                                     │
│  Date                               │
│  ┌─────────────────────────────┐    │
│  │ Sat 15 August 2026        ▾ │    │
│  └─────────────────────────────┘    │
│                                     │
│  Roster shift                       │
│  ┌─────┬─────┬─────┬─────┐          │
│  │ AM  │  D  │ PM  │  N  │          │
│  │06:30│09:00│11:00│21:00│          │
│  │  –  │  –  │  –  │  –  │          │
│  │16:30│21:00│23:00│07:00│          │
│  └─────┴─────┴─────┴─────┘          │
│  Optional — fills the times below,  │
│  which you can still edit.          │
│                                     │
│  Start            End               │
│  ┌───────────┐    ┌───────────┐     │
│  │  09:00    │    │  19:00    │     │
│  └───────────┘    └───────────┘     │
│                                     │
│  Was this continuous with your      │
│  rostered shift?                    │
│  ┌──────────────┬──────────────┐    │
│  │ Ran on from  │  Separate    │    │
│  │ my shift     │  shift    ▓▓ │    │
│  └──────────────┴──────────────┘    │
│  Separate shifts have a 4-hour      │
│  minimum payment.                   │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  10h · all at 2× (Saturday) │    │
│  │                     $965.51 │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        Add shift            │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

Notes: the live preview panel updates as fields change — the user sees the shift's value before committing it. The continuous/separate segmented control is pre-selected by the duration heuristic but always visibly a choice, never silent.

The **roster quick-fill** sits between the date and the times because that is the order the work happens in: which day, which shift, and by then the times are already filled. Nothing is selected by default — no answer is as valid as any answer here — and the selection is derived from the time fields, so editing a time clears it and typing a roster pattern by hand lights it up. The time range is set on its own lines under the code because four ranges across a 320px sheet is about 50px a column; the trailing dash carries the range over the break.

**Two variants worth mocking** because they're where the design earns its keep:

- **Overnight shift** — start 22:00, end 06:00. Shows `Ends next day · Sun 16 Aug` as confirmation, and the breakdown reads `8h · all at 2× — Sunday rate carried past midnight ⓘ`.
- **Minimum applied** — a 2h separate shift showing `2h worked → 4h paid · 4-hour minimum (C9.5)` with the amber assumption treatment.

### 5.6 Deductions & tax panel — **essential**

```
┌─────────────────────────────────────┐
│  ← Deductions & tax                 │
│                                     │
│  Pre-tax deductions                 │
│  Salary packaging comes out before  │
│  tax is calculated.                 │
│                                     │
│  Set amount per fortnight           │
│  ┌─────────────────────────────┐    │
│  │ $  611.00                   │    │
│  └─────────────────────────────┘    │
│                                     │
│  Percentage of gross                │
│  ┌─────────────────────────────┐    │
│  │    5                      % │    │
│  └─────────────────────────────┘    │
│  Calculated on your full fortnight  │
│  gross including overtime.          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Gross incl. OT    6,018.66  │    │
│  │ Set amount         −611.00  │    │
│  │ 5% of gross        −300.93  │    │
│  │ ──────────────────────────  │    │
│  │ Taxed on          5,106.73  │    │
│  └─────────────────────────────┘    │
│                                     │
│  Tax                                │
│                                     │
│  Tax-free threshold claimed    ▓━━  │
│  Study or training loan        ━━○  │
│                                     │
│  ⚠ Packaging lowers the study loan  │
│    repayment withheld each pay, but │
│    not what you owe at tax time.    │
│                                     │
└─────────────────────────────────────┘
```

Notes: the live arithmetic panel is the whole reason this screen works — the two deduction boxes interacting is the part people get wrong. The HELP + packaging warning only appears when both are active.

### 5.7 "How this was worked out" expanded — *valuable, not essential*

The trust-building screen. Shows the full derivation:

```
Ordinary fortnightly pay
  AP1 Step 2 base            $95,698 /yr
  + composite 31.58%         (EBA N25.1)
  + roster adjustment 2.20%  (EBA N44)
  = $128,025.36 × 12 ÷ 313   $4,908.32

Overtime rate
  Base only — the composite is not
  included in overtime (EBA N34.1)
  $95,698 × 12 ÷ 313 ÷ 76    $48.28 /h
  at 1.5×                    $72.41 /h
  at 2×                      $96.55 /h

PAYG withholding
  ATO NAT 1004 fortnightly, Scale 2
  Taxed on $6,018.66         $1,620.00
```

Concept first, clause reference second — `roster adjustment 2.20% (EBA N44)`, never `N44 allowance`.

### 5.8 Dark mode — *mock at least the populated fortnight screen*

### 5.9 Desktop layout — *one mockup*

Two columns at `>900px`: inputs left (420px), sticky result right (340px). Same content, no new features. The shift list gains a table treatment with aligned columns.

The result column is 340px, not the ~300px first specified: at 300 the comparison table has about 67px left for its label column once two 16px money columns and their gutters are in, and "Take-home" broke at its own hyphen. The page's `--measure` widens from 720px to 824px at this breakpoint to pay for it — 420 + 340 + a 32px gutter + 32px of page padding. Without that the extra width comes straight out of the inputs column and the shift row starts wrapping its date instead. `.sl-disclaimer` caps itself so the fine print does not stretch to 824.

---

## 6. Copy deck

Approved phrasing. Consistency here matters more than elegance.

| Concept | Use | Never |
| --- | --- | --- |
| The result | "Your OT adds **$698.34** take-home" | "You'll earn", "You get", "Profit" |
| Uncertainty | "Adds about", "Estimate" | "Exactly", "Guaranteed" |
| Gross | "Before tax" | "Gross" (jargon) |
| Tax | "PAYG tax" | "Withholding" (jargon), "Deductions" (ambiguous) |
| Net | "Take-home" | "Net pay", "In your pocket" |
| Retention | "63% kept" | "37% lost", "Tax rate" |
| C9.5 minimum | "2h worked → 4h paid · 4-hour minimum" | Showing 4h with no explanation |
| Continuous OT | "Ran on from my shift" | "Incidental", "Continuous with ordinary duty" |
| Separate OT | "Separate shift" | "Non-continuous attendance", "Pickup" |
| Ratchet | "Sunday rate carried past midnight" | "Ratchet", "Rate escalation" |
| Base pay | "Base pay" | "Ordinary time earnings", "Composite" |
| Privacy | "Nothing you enter leaves this device." | "Secure", "Encrypted", "Private" |
| Rate currency | "Rates effective 04/12/2025" | Nothing at all |
| Meal allowance | "Meal allowance · Tax free · EBA N36" | "Overtime meal", "OT meal", the bare Annex C code |
| Meal allowance, earned | "1h 30m past the 10h AM shift" | "Meal window missed", "No break taken" |
| The two bottom lines | "Take-home" then "Total in the hand" | Two rows both called take-home; the allowance above the tax lines |

### The disclaimer

Permanent, in the footer of every screen, in `--muted` at caption size:

> Estimate only, based on the ACTAS Enterprise Agreement 2023–2026 and ATO withholding schedules. Not payroll advice. Check your payslip.

Not a modal. Not dismissible. Not styled to be ignored, but not shouting either.

---

## 7. Interaction rules

| Rule | Detail |
| --- | --- |
| **No calculate button** | Every input recalculates live. The result is always current. |
| **Result leads the page** | First thing on the page, scrolling away with it. Sticky only in the two-column desktop layout, where pinning cannot cover the inputs. |
| **Number transitions** | ~200ms fade or count. Perceptible, never delaying. |
| **Warnings never block** | Overlapping shifts, 16h+ shifts, out-of-range dates — all amber notes, never disabled buttons. The user knows their roster better than the app does. |
| **Settings are summarised when collapsed** | `Deductions: $611 + 5% · Study debt on`, never `Advanced ▸` |
| **Destructive actions confirm inline** | Deleting a shift shows an undo row for ~5s rather than a confirmation dialog. |
| **Every money figure is inspectable** | Tap or click to expand its derivation. Consistent affordance across all three surfaces. |

---

## 8. Accessibility

Non-negotiable, and cheap at this size.

- Contrast: 4.5:1 body, 3:1 large text, in **both** themes. Check `--muted` on `--paper` specifically — it is the most likely failure.
- Every input has a persistent visible label. No placeholder-only fields.
- Numeric inputs use `inputmode="decimal"` so phones show the number pad.
- The result panel is an `aria-live="polite"` region so changes are announced without interrupting.
- Full keyboard operation with a visible focus ring — `2px` `--teal` offset `2px`.
- `prefers-reduced-motion` removes number transitions entirely.
- Never rely on the red/green distinction alone to convey money in vs money out — the `−` sign and the row label carry it.

---

## 9. What to produce

Priority order. The first five are enough to start building.

1. **Fortnight calculator, populated** (§5.4) — light, mobile. The most important frame.
2. **Add shift sheet** (§5.5) plus its two variants (overnight, minimum applied)
3. **First run / setup** (§5.1)
4. **Quick calculation** (§5.2)
5. **Deductions & tax** (§5.6)
6. Fortnight empty state (§5.3)
7. Fortnight populated — dark (§5.8)
8. "How this was worked out" (§5.7)
9. Desktop layout (§5.9)

Use the real numbers from `IMPLEMENTATION_PLAN.md` §4.5 throughout — AP1 Step 2, $4,908.32 base, the Saturday 10h and Wednesday 18:00–20:00 shifts. Mockups with plausible real figures surface layout problems that lorem-ipsum numbers hide, and these particular figures are the ones the engine is tested against.

One correction to §4.5 that the shipped app carries and a mockup should too: the net delta is **$698.33**, not $698.34 (§3.13 keeps full precision to display; the plan sums two already-rounded lines).

To show the `Meal allowance` and `Total in the hand` rows you need a shift that earns one, because **neither §4.5 shift does** — the allowance needs a 10-hour shift running an hour or more over (§3.11). The wireframe above uses a 16:30–18:00 overrun off an AM shift: one allowance, **$35.38 untaxed**, taking the fortnight to $4,434.04. A pickup entered whole as `06:30–18:00` gives the same.

---

## 10. Success test

Hand the populated mockup to a paramedic who has never seen it. Within ten seconds, without explanation, they should be able to say what the overtime is worth to them.

If they have to ask a question first, the design isn't finished.
