/// <reference types="vite/client" />
/**
 * The engine's purity boundary, asserted rather than trusted.
 *
 * `src/engine/` is pure functions: no DOM, no React, no imports from `ui/`,
 * `components/` or `storage/`. That boundary is what makes the money math
 * testable, and it is the kind of rule that erodes one convenient import at a
 * time — so it is checked here instead of only being written down.
 *
 * Sources are read through `import.meta.glob` rather than `node:fs` so the
 * check needs no `@types/node` in a project that otherwise has no reason to
 * know what a filesystem is.
 */

import { describe, expect, it } from 'vitest'

const sources = import.meta.glob('../*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const sourceFiles = Object.entries(sources).map(([path, source]) => ({
  name: path.replace('../', ''),
  source,
}))

/** Matches the module specifier of every static and dynamic import. */
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

const FORBIDDEN_MODULES = [
  /^\.\.\/ui\b/,
  /^\.\.\/components\b/,
  /^\.\.\/storage\b/,
  // The engine takes reference data as parameters and never reaches for it.
  // Reversing this arrow is what would stop an older fortnight computing
  // against the figures that were current when it was worked.
  /^\.\.\/data\b/,
  /^react/,
]

/** Globals whose presence would mean the engine had reached for the browser. */
const FORBIDDEN_GLOBALS = [
  /\bdocument\./,
  /\bwindow\./,
  /\blocalStorage\b/,
  /\bfetch\s*\(/,
]

function sourceOf(name: string): string {
  const file = sourceFiles.find((f) => f.name === name)
  if (!file) throw new Error(`No engine source named ${name}`)
  return file.source
}

describe('engine boundary', () => {
  it('found the engine sources', () => {
    // Guards the guard: a bad glob would make every assertion below pass
    // vacuously.
    expect(sourceFiles.map((f) => f.name).sort()).toEqual([
      'attendance.ts',
      'calendar.ts',
      'fortnight.ts',
      'index.ts',
      'overtime.ts',
      'packaging.ts',
      'tax.ts',
      'types.ts',
    ])
  })

  it.each(sourceFiles.map((f) => f.name))(
    '%s imports nothing outside the engine',
    (name: string) => {
      const specifiers = [...sourceOf(name).matchAll(IMPORT_SPECIFIER)].map((m) => m[1])

      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN_MODULES) {
          expect(forbidden.test(specifier), `${name} must not import ${specifier}`).toBe(
            false,
          )
        }
      }
    },
  )

  it.each(sourceFiles.map((f) => f.name))(
    '%s touches no browser globals',
    (name: string) => {
      // Comments legitimately mention `localStorage` and the DOM, so they are
      // stripped before the check rather than being allowed to fail it.
      const code = sourceOf(name)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')

      for (const forbidden of FORBIDDEN_GLOBALS) {
        expect(forbidden.test(code), `${name} must not use ${forbidden}`).toBe(false)
      }
    },
  )
})
