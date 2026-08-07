import type { ReactNode } from 'react'

export interface ShiftListProps {
  /** Section heading, e.g. "Overtime shifts". */
  title: string
  /** Shown right-aligned against the heading. Omitted when empty. */
  count?: number
  /** ShiftRow children, or an EmptyState. */
  children: ReactNode
}

/** Heading plus the bordered container the rows divide themselves inside. */
export function ShiftList({ title, count, children }: ShiftListProps) {
  return (
    <section>
      <div className="sl-shift-list__header">
        <h2 className="sl-heading">{title}</h2>
        {count !== undefined && count > 0 ? (
          <span className="sl-shift-list__count">{count}</span>
        ) : null}
      </div>
      {count !== undefined && count > 0 ? (
        <div className="sl-shift-list">{children}</div>
      ) : (
        children
      )}
    </section>
  )
}
