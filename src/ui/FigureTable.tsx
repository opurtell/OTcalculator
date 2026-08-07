import { Fragment, useState } from 'react'
import { Money } from './Money'
import type { MoneySign } from './format'

export interface FigureRow {
  label: string
  /** Caption under the label — the "why" for a figure that needs one. */
  note?: string
  /** One value per column. Numbers render as money; strings render verbatim. */
  values: (number | string)[]
  tone?: 'default' | 'out' | 'net' | 'muted'
  sign?: MoneySign
  /** Rule above and heavier weight — the Net or Taxed on line. */
  total?: boolean
  /**
   * The working behind this row. When present the label becomes a control and
   * the derivation expands beneath it — the same inspect affordance the rest
   * of the app uses (§7).
   */
  derivation?: FigureRow[]
}

export interface FigureTableProps {
  /** Column headers. Omit the leading blank — it is added for the label column. */
  columns?: string[]
  rows: FigureRow[]
  /** Accessible name, e.g. "Fortnight with and without overtime". */
  caption: string
}

function Cells({ row }: { row: FigureRow }) {
  return (
    <>
      {row.values.map((value, index) => (
        <td key={index}>
          {typeof value === 'number' ? (
            <Money
              value={value}
              tone={row.tone}
              sign={row.sign}
              currency={false}
            />
          ) : (
            <span className="sl-figure">{value}</span>
          )}
        </td>
      ))}
    </>
  )
}

/**
 * The comparison table, the deductions arithmetic, and the derivation panel are
 * all this component. Figures are right-aligned and tabular so columns line up
 * on the decimal.
 */
export function FigureTable({ columns, rows, caption }: FigureTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const span = 1 + (columns?.length ?? Math.max(1, rows[0]?.values.length ?? 1))

  return (
    <table className="sl-figures">
      <caption className="sl-visually-hidden">{caption}</caption>
      {columns ? (
        <thead>
          <tr>
            <th scope="col" />
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((row) => {
          const open = expanded === row.label
          return (
            <Fragment key={row.label}>
              <tr className={row.total ? 'sl-figures__row--total' : undefined}>
                <th scope="row">
                  {row.derivation ? (
                    <button
                      type="button"
                      className="sl-figures__inspect"
                      aria-expanded={open}
                      aria-label={`${row.label} — how this was worked out`}
                      onClick={() => setExpanded(open ? null : row.label)}
                    >
                      {row.label}
                    </button>
                  ) : (
                    row.label
                  )}
                  {row.note ? (
                    <span className="sl-figures__note">{row.note}</span>
                  ) : null}
                </th>
                <Cells row={row} />
              </tr>
              {row.derivation && open ? (
                <tr className="sl-figures__derivation">
                  <td colSpan={span}>
                    <FigureTable
                      caption={`How ${row.label} was worked out`}
                      rows={row.derivation}
                    />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}
