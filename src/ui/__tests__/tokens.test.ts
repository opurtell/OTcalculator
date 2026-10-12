import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const UI = join(__dirname, '..')
const css = readdirSync(UI).filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(UI, f), 'utf8')).join('\n')

describe('Station Ledger custom properties', () => {
  // The Pay Tracker embeds this library and declares --font-sans/--font-mono
  // itself; tokens.css sets them on :root, so they would leak. Keep the
  // library's names namespaced.
  it('does not declare the generic font tokens', () => {
    expect(css).not.toMatch(/--font-(sans|mono)\s*:/)
    expect(css).toMatch(/--sl-font-sans\s*:/)
    expect(css).toMatch(/--sl-font-mono\s*:/)
  })
})
