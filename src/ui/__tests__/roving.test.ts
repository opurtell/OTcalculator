/**
 * The index arithmetic behind arrow-key navigation.
 *
 * The DOM half of `roving.ts` — finding the group and moving focus — needs a
 * browser and is checked by hand; this is the half that can be quietly wrong,
 * where an off-by-one shows up as a key that skips an option or a wrap that
 * lands nowhere.
 */

import { describe, expect, it } from 'vitest'
import { nextIndex } from '../roving'

describe('nextIndex', () => {
  it('moves forward and back along the group', () => {
    expect(nextIndex('ArrowRight', 4, 1)).toBe(2)
    expect(nextIndex('ArrowLeft', 4, 1)).toBe(0)
  })

  it('wraps at both ends', () => {
    expect(nextIndex('ArrowRight', 4, 3)).toBe(0)
    expect(nextIndex('ArrowLeft', 4, 0)).toBe(3)
  })

  it('jumps to the ends with Home and End', () => {
    expect(nextIndex('Home', 4, 2)).toBe(0)
    expect(nextIndex('End', 4, 2)).toBe(3)
  })

  it('ignores the vertical axis unless the group is a radio group', () => {
    expect(nextIndex('ArrowDown', 4, 1)).toBeNull()
    expect(nextIndex('ArrowUp', 4, 1)).toBeNull()
    expect(nextIndex('ArrowDown', 4, 1, 'both')).toBe(2)
    expect(nextIndex('ArrowUp', 4, 1, 'both')).toBe(0)
  })

  it('ignores keys that mean something else', () => {
    for (const key of ['Enter', ' ', 'Tab', 'Escape', 'a', 'PageDown']) {
      expect(nextIndex(key, 4, 1)).toBeNull()
    }
  })

  // A segmented control whose value is not one of its options — a stale pay
  // step, say — is still reachable: the first arrow press enters the group
  // from whichever end the key points at, rather than doing nothing.
  it('enters the group from an end when nothing is selected', () => {
    expect(nextIndex('ArrowRight', 4, -1)).toBe(0)
    expect(nextIndex('ArrowLeft', 4, -1)).toBe(3)
    expect(nextIndex('ArrowRight', 4, 99)).toBe(0)
  })

  it('has nothing to say about an empty group', () => {
    expect(nextIndex('ArrowRight', 0, 0)).toBeNull()
    expect(nextIndex('Home', 0, 0)).toBeNull()
  })

  it('leaves a single-option group where it is', () => {
    expect(nextIndex('ArrowRight', 1, 0)).toBe(0)
    expect(nextIndex('ArrowLeft', 1, 0)).toBe(0)
  })
})
