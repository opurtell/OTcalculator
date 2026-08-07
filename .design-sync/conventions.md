## Station Ledger — how to build with this system

A calculator for ACTAS paramedics working out what an overtime shift is worth.
It is a fast decision tool, not a dashboard and not a marketing surface.

### Wrap everything in `StationLedger`

`StationLedger` is the root wrapper and it is **required**. It carries the
`sl-root` class that supplies the page background, ink colour, base type,
box-sizing and the focus-ring rule. Components rendered outside it inherit the
host page's styles instead: unstyled text on a transparent background, with no
focus ring and no theme.

```jsx
<StationLedger measure>
  <ResultPanel label="Your OT adds" amount={698.34} beforeTax={1110.34} />
</StationLedger>
```

`measure` constrains to the 720px calculator column and adds the page gutter.
`theme="light" | "dark"` forces a theme; **omit it to follow the OS**, which is
the normal case. Dark mode is a requirement here, not a nicety — a 3am shift
offer is a real use case — so check both.

### Styling idiom: CSS custom properties

There is no utility-class framework. Style your own layout glue with the
design tokens, all defined in `styles.css`:

| Group | Tokens |
| --- | --- |
| Surface | `--paper` `--surface` `--surface-raised` — note `--surface-raised` equals `--surface` in light mode and only separates in dark, so `Panel variant="raised"` is deliberately a no-op on a light background |
| Text | `--ink` `--muted` |
| Line | `--line` |
| Accent | `--teal` `--green` `--amber` `--red` |
| On-accent | `--on-teal` — label colour for anything **filled** with `--teal`. Use it instead of white: in dark mode the teal is light enough that white fails contrast. |
| Wash | `--amber-wash` `--teal-wash` |
| Space | `--space-1` … `--space-7` (4·8·12·16·24·32·48) |
| Radius | `--radius-control` (4px) `--radius-panel` (8px) `--radius-result` (12px) |
| Type | `--font-sans` `--font-mono` `--text-result` `--text-heading` `--text-body` `--text-figure` `--text-caption` |
| Other | `--measure` `--shadow-result` `--focus-ring` `--duration-figure` |

Colour carries meaning here, so don't spend it freely:

- `--red` is **money leaving** — tax, deductions. Never error or alarm; this
  app has no alarming states.
- `--green` is the **net result only**. Nothing else gets it, or it stops
  meaning anything.
- `--amber` marks **assumptions worth confirming**, not problems.
- Colour never carries meaning alone — pair it with a label, a sign, or
  structure.

A few helper classes exist for glue: `sl-measure`, `sl-stack`, `sl-heading`,
`sl-caption`, `sl-label`, `sl-hint`, `sl-figure` (mono + tabular numerals),
`sl-visually-hidden`. Don't invent new `sl-` classes — they won't resolve.

### Rules that are not negotiable

1. **The number is the interface.** When in doubt, make the result bigger and
   the controls quieter. Only the answer is visually loud.
2. **Never show an unexplained figure.** If it pays 4h for 2h worked, say why
   on the same line — that's what `ShiftRow.breakdown` and `AssumptionNote`
   are for.
3. **Render every money figure through `Money`** (or `FigureTable`, which uses
   it). Mono, tabular, two decimals, explicit minus. Never format money by hand
   — digits shifting as the result updates is the bug this prevents.
4. **No calculate button.** Every input recalculates live.
5. **Collapsed settings state what's active.** `Disclosure` takes a `summary`
   prop: `Deductions: $611 + 5% · Study debt on`, never a bare `Advanced`.
6. **`Disclaimer` goes at the foot of every screen.** It takes no props.
7. **Destructive actions never open a dialog.** Do the thing, then render
   `UndoRow` — the delete is already done and reversible for five seconds.
8. **Warnings never block.** Overlapping shifts, 16h+ shifts, out-of-range
   dates all render as `AssumptionNote`, never as a disabled button. The user
   knows their roster better than the app does.
9. Avoid entirely: gradients, card shadows, illustrations, celebration states,
   progress rings, up-arrows, emoji, marketing language. **Never type an icon
   glyph** — `⚠` and `✎` render as colour emoji on most platforms. Draw them
   as inline SVG with `currentColor`, as `AssumptionNote` and `TextField` do.

### Building a screen

Reach for `CalculatorLayout` — it takes the result panel as a `result` prop and
the inputs as children, stacks below 900px with the result pinned on top, and
becomes inputs-left / sticky-result-right above it. Nothing else needs writing
to get the responsive behaviour right.

`ShiftRow` gains a row menu when given `onDelete` / `onDuplicate`; swipe-to-
delete comes with it as a touch layer, but the menu is the discoverable and
keyboard-reachable route, so never rely on the gesture alone.

For a figure that needs its working shown, either use `InspectableFigure`
standalone or give a `FigureTable` row a `derivation` array — both render the
same dotted-underline affordance.

### Where the truth lives

Read `styles.css` and the `_ds_bundle.css` it imports before styling anything
— every token, helper class and component rule is defined there, and the real
file beats any summary. Each component's `.prompt.md` carries its props and
intent.

### Copy

"Your OT adds", "take-home", "before tax", "PAYG tax", "63% kept",
"Separate shift", "Ran on from my shift". Never "you'll earn", "gross", "net
pay", "37% lost", or "profit".
