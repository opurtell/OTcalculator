/**
 * The figure table's corner header.
 *
 * The top-left `th` heads the row-label column but has nothing to show, and an
 * empty `th` fails axe `empty-table-header`: a screen reader announces a column
 * with no name. It carries a visually hidden label instead, so nothing changes
 * on screen.
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FigureTable } from '../FigureTable'

const html = renderToStaticMarkup(
  <FigureTable
    caption="Pay with and without overtime"
    columns={['Without OT', 'With OT']}
    rows={[{ label: 'Base pay', values: [100, 100] }]}
  />,
)

describe('FigureTable corner header', () => {
  it('names the row-label column for assistive technology', () => {
    const corner = html.match(/<thead><tr><th scope="col">(.*?)<\/th>/)
    expect(corner).not.toBeNull()
    expect(corner![1]).toBe('<span class="sl-visually-hidden">Item</span>')
  })

  it('leaves no table header without text', () => {
    const headers = [...html.matchAll(/<th\b[^>]*>(.*?)<\/th>/g)]
    expect(headers.length).toBeGreaterThan(0)
    for (const [, inner] of headers) {
      expect(inner.replace(/<[^>]+>/g, '').trim()).not.toBe('')
    }
  })
})
