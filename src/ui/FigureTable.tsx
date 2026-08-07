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
}

export interface FigureTableProps {
  /** Column headers. Omit the leading blank — it is added for the label column. */
  columns?: string[]
  rows: FigureRow[]
  /** Accessible name, e.g. "Fortnight with and without overtime". */
  caption: string
}

/**
 * The comparison table, the deductions arithmetic, and the derivation panel are
 * all this component. Figures are right-aligned and tabular so columns line up
 * on the decimal.
 */
export function FigureTable({ columns, rows, caption }: FigureTableProps) {
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
        {rows.map((row) => (
          <tr
            key={row.label}
            className={row.total ? 'sl-figures__row--total' : undefined}
          >
            <th scope="row">
              {row.label}
              {row.note ? (
                <span className="sl-figures__note">{row.note}</span>
              ) : null}
            </th>
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
          </tr>
        ))}
      </tbody>
    </table>
  )
}
