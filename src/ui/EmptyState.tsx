export interface EmptyStateProps {
  title: string
  body: string
}

/** Dashed outline, plain instruction, no illustration. */
export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="sl-empty">
      <p className="sl-empty__title">{title}</p>
      <p className="sl-empty__body">{body}</p>
    </div>
  )
}
