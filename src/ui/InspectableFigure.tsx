import { useId, useState } from 'react'
import { Money } from './Money'
import type { MoneySign } from './format'
import type { FigureRow } from './FigureTable'
import { FigureTable } from './FigureTable'

export interface InspectableFigureProps {
  value: number
  /** Names the figure for screen readers: "PAYG tax". */
  label: string
  /** The working, shown when expanded. */
  derivation: FigureRow[]
  tone?: 'default' | 'out' | 'net' | 'muted'
  size?: 'inline' | 'display'
  sign?: MoneySign
  currency?: boolean
}

/**
 * Every money figure is inspectable (§7) — tap or click to expand how it was
 * reached. This is the single affordance for that across all three surfaces,
 * so a figure behaves the same wherever it appears.
 *
 * The dotted underline is the affordance. It has to be visible without being
 * loud: an unexplained figure destroys trust, but a figure shouting for
 * attention competes with the result.
 */
export function InspectableFigure({
  value,
  label,
  derivation,
  tone = 'default',
  size = 'inline',
  sign = 'auto',
  currency = true,
}: InspectableFigureProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <span className="sl-inspect">
      <button
        type="button"
        className="sl-inspect__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${label} — how this was worked out`}
        onClick={() => setOpen((current) => !current)}
      >
        <Money
          value={value}
          tone={tone}
          size={size}
          sign={sign}
          currency={currency}
        />
      </button>
      <span id={panelId} className="sl-inspect__panel" hidden={!open}>
        <FigureTable caption={`How ${label} was worked out`} rows={derivation} />
      </span>
    </span>
  )
}
