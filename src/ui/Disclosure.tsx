import { useId, useState } from 'react'
import type { ReactNode } from 'react'

export interface DisclosureProps {
  /** The trigger line, e.g. "How this was worked out". */
  title: string
  /**
   * What is currently active, shown while collapsed —
   * `Deductions: $611 + 5% · Study debt on`, never a bare "Advanced" (§7).
   */
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}

/** Progressive disclosure, honestly labelled. */
export function Disclosure({
  title,
  summary,
  defaultOpen = false,
  children,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <div className="sl-disclosure">
      <button
        type="button"
        className="sl-disclosure__trigger"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>
          {title}
          {summary && !open ? (
            <span className="sl-disclosure__summary">{summary}</span>
          ) : null}
        </span>
        <span className="sl-disclosure__marker" aria-hidden="true">
          ▸
        </span>
      </button>
      <div id={contentId} className="sl-disclosure__content" hidden={!open}>
        {children}
      </div>
    </div>
  )
}
