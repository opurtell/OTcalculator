/**
 * The engine's vocabulary.
 *
 * Two rules govern everything in `src/engine/`:
 *
 * 1. **No reference data lives here.** Pay rates, tax coefficients and the
 *    public holiday list arrive as parameters. The only figures the engine
 *    owns are the EBA's structural constants below — the ones that are part of
 *    the *formula* rather than part of a table that gets reissued each year.
 * 2. **Full precision throughout.** Nothing rounds until it reaches a screen.
 *    See `IMPLEMENTATION_PLAN.md` §3.12.
 */

/** `'YYYY-MM-DD'`, ACT wall-clock, lexicographically sortable. */
export type IsoDate = string

/** Minutes since midnight, 0–1439. */
export type Minutes = number

/**
 * The five overtime rate categories (§3.3).
 *
 * The three 2× categories stay distinct even though they tie numerically: they
 * read differently in the breakdown, and a future agreement may break the
 * parity.
 */
export type OtCategory = 'mf_1_5x' | 'mf_2x' | 'sat_2x' | 'sun_2x' | 'ph_2_5x'

export const MULTIPLIER: Readonly<Record<OtCategory, number>> = {
  mf_1_5x: 1.5,
  mf_2x: 2,
  sat_2x: 2,
  sun_2x: 2,
  ph_2_5x: 2.5,
}

/** How a category reads in the shift breakdown line. */
export const CATEGORY_LABEL: Readonly<Record<OtCategory, string>> = {
  mf_1_5x: '1.5×',
  mf_2x: '2×',
  sat_2x: '2× (Saturday)',
  sun_2x: '2× (Sunday)',
  ph_2_5x: '2.5× (public holiday)',
}

/**
 * Whether the overtime ran on from rostered duty or stood alone.
 *
 * This is the C9.5 distinction and it changes the money, so it is a stored
 * property of the shift rather than something inferred at calculation time.
 * Matches `ShiftKind` in `src/ui/ShiftRow.tsx` deliberately — the row renders
 * this value directly.
 */
export type ShiftKind = 'separate' | 'overrun'

export interface OtShift {
  id: string
  date: IsoDate
  startMin: Minutes
  endMin: Minutes
  /** True when `endMin` falls on the day after `date`. */
  endsNextDay: boolean
  kind: ShiftKind
}

/** A worked stretch of wall-clock time. Gaps between shifts are not intervals. */
export interface Interval {
  date: IsoDate
  startMin: Minutes
  durationMinutes: number
}

/**
 * A run of contiguous minutes paid at one category.
 *
 * `date`/`startMin` are where the segment begins on the calendar, which is what
 * the breakdown line shows. `offsetMinutes` is its distance from the start of
 * the attendance, which is what makes segments orderable across midnight.
 */
export interface Segment {
  category: OtCategory
  minutes: number
  date: IsoDate
  startMin: Minutes
  offsetMinutes: number
}

/**
 * A pay band. `annualBase` and `annexATotal` are both stored because §3.1 says
 * to use the published Annex A totals verbatim rather than recomputing them —
 * the EBA tables are rounded to whole dollars and recomputation drifts.
 */
export interface PayBand {
  classification: string
  step: number
  /**
   * Base salary only. **Never the composite.** EBA N34.1 — overtime is
   * calculated on this figure, and using `annexATotal` here inflates every
   * result by about 34%. For AP1 Step 2 this is 95_698, not 125_920.
   */
  annualBase: number
  /** The composite-inclusive published total. Ordinary pay only, never OT. */
  annexATotal: number
}

/** `'2025-26'`. Australian financial years run 1 July to 30 June. */
export type FinancialYear = string

/**
 * One row of the NAT 1004 weekly coefficient table.
 *
 * The ATO publishes this as `withholding = a × x − b`, where `x` is weekly
 * earnings plus 99 cents. `rate` is `a` and `base` is `b`; the names match the
 * sibling project's `tax-scales.json` so the two stay diffable.
 */
export interface TaxBracket {
  /** Row applies when weekly earnings are strictly below this. */
  threshold: number
  /** `a` — the coefficient, not a marginal tax rate. */
  rate: number
  /** `b` — the subtrahend, not a dollar base amount. */
  base: number
}

export interface TaxScale {
  financialYear: FinancialYear
  /** 1 = tax-free threshold not claimed, 2 = claimed. §3.8. */
  scale: 1 | 2
  brackets: readonly TaxBracket[]
}

/**
 * A HELP/HECS repayment row (NAT 3539).
 *
 * `basis` matters: some rows charge a rate on *total* repayment income, others
 * only on the amount above the threshold. Treating them alike overstates the
 * repayment badly at the boundaries.
 */
export interface HelpBracket {
  incomeFrom: number
  /** `null` on the open-ended top row. */
  incomeTo: number | null
  rate: number
  /** Fixed amount added before the rate, on `amount_over_threshold` rows. */
  base?: number
  basis: 'total_income' | 'amount_over_threshold'
}

export interface HelpSchedule {
  financialYear: FinancialYear
  brackets: readonly HelpBracket[]
}

/** FBT-exempt salary packaging caps (§3.10). Need an annual currency check. */
export interface PackagingCaps {
  effectiveFrom: IsoDate
  livingExpensesCap: number
  mealEntertainmentCap: number
  /** FBT Type 2 gross-up, for the reportable fringe benefit warning. */
  grossUpFactor: number
}

/**
 * ACT public holidays as data, with an explicit horizon.
 *
 * The horizon is not decoration: the list ends, and a shift past the end must
 * produce a warning rather than a silently underpaid weekday rate (§3.7).
 */
export interface HolidayCalendar {
  dates: ReadonlySet<IsoDate>
  /** Last date the list is known complete through. */
  coversThrough: IsoDate
}

/**
 * Something about this attendance the user needs to see. The engine never
 * silently resolves an ambiguity — it computes its best answer and says so.
 */
export type AttendanceFlag =
  /** Shifts were merged across a gap in the 30–120 min band (§3.5). */
  | { kind: 'grouping-uncertain'; gapMinutes: number }
  /** A date falls past `HolidayCalendar.coversThrough` (§3.7). */
  | { kind: 'beyond-holiday-data'; date: IsoDate }
  /** A date is a daylight-saving transition, so wall-clock hours mislead (§3.13). */
  | { kind: 'dst-transition'; date: IsoDate }

// ---------------------------------------------------------------------------
// Structural constants — formula, not table
// ---------------------------------------------------------------------------

/** Ordinary fortnightly hours: 38/week × 2. The OT divisor in N34.1. */
export const ORDINARY_FORTNIGHTLY_HOURS = 76

/**
 * The EBA's own annual-to-fortnightly divisor (C3.3) — `12/313`, giving
 * 26.0833 fortnights a year. Not `/26`.
 */
export const FORTNIGHTS_PER_YEAR_NUMERATOR = 12
export const FORTNIGHTS_PER_YEAR_DENOMINATOR = 313

/** Mon–Fri overtime runs at 1.5× for this long, then 2× (§3.3). */
export const MF_FIRST_TIER_MINUTES = 120

/** EBA C9.5 minimum payment for overtime not continuous with ordinary duty. */
export const MINIMUM_PAYMENT_MINUTES = 240

/** Gaps up to this long keep one attendance together — meal breaks, C9.7. */
export const ATTENDANCE_GAP_MINUTES = 60

/** Gaps inside this band are grouped per the rule above, but flagged (§3.5). */
export const GROUPING_UNCERTAIN_MIN_MINUTES = 30
export const GROUPING_UNCERTAIN_MAX_MINUTES = 120

export const MINUTES_PER_DAY = 1440
