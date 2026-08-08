/**
 * Contrast, in both themes, from the tokens themselves.
 *
 * §8 calls 4.5:1 non-negotiable and names `--muted` on `--paper` as the likely
 * failure. That has been true since the palette was written and nothing was
 * defending it: a designer's retune of one hex is exactly the change that
 * quietly drops a caption below legibility on a phone in daylight.
 *
 * The palette is also spelled out three times in `tokens.css` — light on
 * `:root`, dark under the system preference, dark again under
 * `[data-theme='dark']` — because CSS has no mixins. Dark mode has broken here
 * once already by the copies drifting apart, so this checks they still agree.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const TOKENS = readFileSync(
  fileURLToPath(new URL('../tokens.css', import.meta.url)),
  'utf8',
)

type Palette = Record<string, string>

/**
 * The declarations of the block a selector opens.
 *
 * Deliberately naive — it takes the text between the selector's `{` and the
 * first `}`, which is exactly right for a flat block of custom properties and
 * would be wrong for anything nested. `tokens.css` is flat by design.
 */
function block(selector: string): Palette {
  const start = TOKENS.indexOf(selector)
  expect(start, `${selector} is missing from tokens.css`).toBeGreaterThan(-1)

  const open = TOKENS.indexOf('{', start)
  const close = TOKENS.indexOf('}', open)
  const palette: Palette = {}

  for (const [, name, value] of TOKENS.slice(open, close).matchAll(
    /(--[\w-]+)\s*:\s*([^;]+);/g,
  )) {
    palette[name] = value.trim()
  }
  return palette
}

const LIGHT = block(':root {')
const DARK = block("[data-theme='dark'] {")
const LIGHT_ISLAND = block("[data-theme='light'] {")
const DARK_MEDIA = block(":root:not([data-theme='light']) {")

/** Relative luminance, WCAG 2.1 §relative-luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/**
 * Every foreground/background pairing the app actually renders.
 *
 * Kept as pairs of token names rather than colours so it reads as a claim
 * about the design — "muted text appears on the amber wash" — and so both
 * themes are checked by the same list.
 */
const PAIRS: [foreground: string, background: string][] = [
  // Body and captions, on each of the three grounds.
  ['--ink', '--paper'],
  ['--ink', '--surface'],
  ['--ink', '--surface-raised'],
  ['--muted', '--paper'],
  ['--muted', '--surface'],
  ['--muted', '--surface-raised'],
  // The two washes: the assumption block and the shift-sheet preview.
  ['--ink', '--amber-wash'],
  ['--muted', '--amber-wash'],
  ['--amber', '--amber-wash'],
  ['--ink', '--teal-wash'],
  ['--muted', '--teal-wash'],
  ['--teal', '--teal-wash'],
  // Links, tab underlines and ghost buttons.
  ['--teal', '--paper'],
  ['--teal', '--surface'],
  ['--teal', '--surface-raised'],
  // Anything filled with teal — the primary button.
  ['--on-teal', '--teal'],
  // Money in and money out. The sign and the row label carry the meaning too
  // (§8), but the colours still have to be readable on their own.
  ['--green', '--surface'],
  ['--green', '--surface-raised'],
  ['--red', '--surface'],
  ['--red', '--surface-raised'],
]

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s theme', (theme, palette) => {
  it.each(PAIRS)('%s on %s clears 4.5:1', (foreground, background) => {
    const ratio = contrast(palette[foreground], palette[background])
    expect(
      ratio,
      `${foreground} on ${background} in ${theme} is ${ratio.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the three copies of the palette', () => {
  it('agree on dark', () => {
    expect(DARK_MEDIA).toEqual(DARK)
  })

  it('agree on light', () => {
    // The `:root` block carries the type, spacing and shape tokens as well, so
    // the light island is a subset of it rather than an equal.
    for (const [token, value] of Object.entries(LIGHT_ISLAND)) {
      expect(LIGHT[token], `${token} differs between :root and [data-theme='light']`).toBe(value)
    }
  })

  it('cover every colour the other theme defines', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT_ISLAND).sort())
  })
})
