import type { ReactNode } from 'react'

export interface AssumptionNoteProps {
  children: ReactNode
}

/**
 * The amber left-ruled block. Amber marks assumptions and things worth
 * confirming — not problems (§4.1).
 *
 * These are always expanded and never dismissible: warnings never block, but
 * they also never hide. The user knows their roster better than the app does,
 * so an assumption note explains rather than prevents.
 */
export function AssumptionNote({ children }: AssumptionNoteProps) {
  return (
    <div className="sl-note">
      {/* Drawn, not typed: a literal ⚠ renders as colour emoji on most
          platforms, and the brief bans emoji in the interface. */}
      <svg
        className="sl-note__icon"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 1.6 15 14H1L8 1.6Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M8 6.2v3.4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11.6" r="0.85" fill="currentColor" />
      </svg>
      <div className="sl-note__body">{children}</div>
    </div>
  )
}
