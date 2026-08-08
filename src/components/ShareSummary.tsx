import { useEffect, useState } from 'react'
import { Button } from '../ui/index'
import { summaryText } from '../app/summary'
import type { SummaryInput } from '../app/summary'

/**
 * Send the fortnight somewhere else — a message to a partner, a printout for
 * the roster officer.
 *
 * Two routes, because they are two different acts: sharing puts the figures in
 * a conversation, printing puts them on paper next to a payslip. Both carry
 * the shifts, the tax line and the disclaimer (`app/summary.ts`), because a
 * bare number in a group chat is exactly the thing the app's "never show an
 * unexplained figure" rule exists to prevent.
 *
 * The share text is built from a pure function and nothing is encoded into the
 * URL — the app's promise is that nothing leaves the device unless the user
 * sends it, and a link carrying someone's pay band would break that quietly.
 */
export function ShareSummary(props: SummaryInput) {
  // Capability is read after mount rather than at render: `navigator` does not
  // exist while these components are rendered to markup in tests, and the
  // label must not claim a share sheet that isn't there.
  const [canShare, setCanShare] = useState(false)
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2500)
    return () => clearTimeout(timer)
  }, [state])

  async function send() {
    const text = summaryText(props)

    if (canShare) {
      try {
        await navigator.share({ title: 'ACTAS OT estimate', text })
        return
      } catch {
        // Includes the user dismissing the sheet, which is not a failure worth
        // reporting — fall through to the clipboard so the action still did
        // something rather than nothing.
      }
    }

    setState((await copyToClipboard(text)) ? 'copied' : 'failed')
  }

  return (
    <div className="sl-share">
      <Button variant="ghost" onClick={send}>
        {canShare ? 'Share summary' : 'Copy summary'}
      </Button>
      <Button variant="ghost" onClick={() => window.print()}>
        Print
      </Button>
      {/* Announced rather than merely shown: the button's own label does not
          change, so a screen reader would otherwise have no way to know the
          copy happened. */}
      <span className="sl-share__status" role="status">
        {state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : ''}
      </span>
    </div>
  )
}

/**
 * The clipboard, by whichever route this browser allows.
 *
 * `navigator.clipboard` needs a secure context and is refused outright in some
 * locked-down browsers — the same ones that refuse `localStorage`, which this
 * app already expects (§4.4). The textarea route is the fallback that has
 * worked everywhere for a decade.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through.
  }

  try {
    const field = document.createElement('textarea')
    field.value = text
    field.setAttribute('readonly', '')
    // Off-screen rather than hidden: a `display: none` field cannot be
    // selected, and selecting is the whole mechanism here.
    field.style.position = 'fixed'
    field.style.top = '-1000px'
    document.body.append(field)
    field.select()
    const copied = document.execCommand('copy')
    field.remove()
    return copied
  } catch {
    return false
  }
}
