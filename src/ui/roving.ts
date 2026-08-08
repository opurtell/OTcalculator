import type { KeyboardEvent } from 'react'

/**
 * Keyboard navigation for the two composite widgets — the pathway tabs and the
 * segmented control.
 *
 * Both are a row of buttons standing in for a single control, which is what
 * `role="tablist"` and `role="radiogroup"` say. A screen reader user therefore
 * expects one tab stop for the whole group and the arrow keys to move within
 * it (§8, "full keyboard operation"). Without that, `Tab` walks through every
 * option one at a time and the roles are a lie.
 *
 * The index arithmetic is separated from the DOM because the arithmetic is the
 * part that can be wrong — see `__tests__/roving.test.ts`.
 */

/**
 * `horizontal` is the tabs pattern: left and right only, so a vertical arrow
 * still scrolls the page. `both` is the radio-group pattern, where either axis
 * moves the selection.
 */
export type RovingOrientation = 'horizontal' | 'both'

/** The group role that owns each option role, used to find the container. */
const GROUP_ROLE = {
  tab: 'tablist',
  radio: 'radiogroup',
} as const

export type RovingRole = keyof typeof GROUP_ROLE

/**
 * The index the key should move to, or `null` when the key means nothing here.
 *
 * Movement wraps: from the last option, forward returns to the first. Both
 * groups here have two to four options, where wrapping is the difference
 * between one keypress and three.
 */
export function nextIndex(
  key: string,
  count: number,
  current: number,
  orientation: RovingOrientation = 'horizontal',
): number | null {
  if (count <= 0) return null

  // A `current` outside the group (nothing selected, or a stale value) still
  // has to answer sensibly, so both directions start from an end.
  const from = current >= 0 && current < count ? current : -1

  switch (key) {
    case 'ArrowRight':
      return from < 0 ? 0 : (from + 1) % count
    case 'ArrowLeft':
      return from < 0 ? count - 1 : (from - 1 + count) % count
    case 'ArrowDown':
      return orientation === 'both' ? nextIndex('ArrowRight', count, current) : null
    case 'ArrowUp':
      return orientation === 'both' ? nextIndex('ArrowLeft', count, current) : null
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}

export interface RovingKeyOptions {
  /** The role each option carries — `tab` or `radio`. */
  role: RovingRole
  count: number
  /** The index of the currently selected option. */
  current: number
  orientation?: RovingOrientation
  /** Selects the option at `index`. Selection follows focus in both widgets. */
  onSelect: (index: number) => void
}

/**
 * The DOM half: move focus to the option the key names, and select it.
 *
 * Selection follows focus here, which the ARIA practices allow when switching
 * is cheap and reversible. It is: both widgets change what is on screen, not
 * what is saved, and arrowing back undoes it.
 *
 * Focus is moved by querying the group rather than by holding a ref per
 * option — the options are already identified by their role, and one query at
 * keypress time is cheaper than a ref array maintained on every render.
 */
export function rovingKeyDown(
  event: KeyboardEvent<HTMLElement>,
  { role, count, current, orientation = 'horizontal', onSelect }: RovingKeyOptions,
): void {
  const target = nextIndex(event.key, count, current, orientation)
  if (target === null) return

  event.preventDefault()

  const group = event.currentTarget.closest(`[role="${GROUP_ROLE[role]}"]`)
  const options = group?.querySelectorAll<HTMLElement>(`[role="${role}"]`)
  options?.item(target)?.focus()

  onSelect(target)
}
