/**
 * The committed icons, against what each platform actually does with them.
 *
 * These PNGs are build output checked into `public/`, so nothing else in the
 * repo would notice them going wrong, and the failure mode is invisible from a
 * desktop browser: you only see it after adding the site to a home screen on a
 * real phone. One of these did ship broken — the maskable icon shrank the
 * whole mark to fit Android's safe zone, which leaves the cropped area
 * transparent, and a launcher draws that as a small tile on a black square.
 *
 * The rule underneath it: a home-screen icon is masked *again* by the
 * platform, so it has to be opaque edge to edge and keep its content in the
 * middle. iOS is the quieter case — Safari composites alpha onto black before
 * applying its superellipse, so a rounded icon is fine only while its corner
 * stays tighter than Apple's, which is a coincidence rather than a design.
 * These tests hold all of them to the same contract so it stops mattering.
 *
 * Regenerate with `node scripts/make-icons.mjs`, which is where the shapes are
 * defined and explained.
 */

import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PUBLIC = new URL('../../../public/', import.meta.url)

/** The tile colour, which is `--teal`; see scripts/make-icons.mjs. */
const TEAL = [0x17, 0x6b, 0x6b]

/**
 * The fraction of the width a maskable icon is guaranteed to keep: the middle
 * 80%, i.e. everything within 0.4 of the width from the centre. A launcher may
 * keep more — that is the point of the guarantee — but never less.
 */
const SAFE_RADIUS = 0.4

/**
 * iOS keeps far more than Android's safe zone: it cuts a superellipse
 * inscribed in the full square, which trims the corners and nothing else. That
 * is a different rule from `SAFE_RADIUS`, not a laxer version of it — a circle
 * of radius 0.4 is well inside this, while a point at 0.45 of the width is
 * inside diagonally and outside horizontally. Modelled at n = 5, which is the
 * usual approximation of Apple's curve.
 */
const insideAppleMask = (u: number, v: number) =>
  Math.abs(u / 0.5) ** 5 + Math.abs(v / 0.5) ** 5 <= 1

type Pixel = [number, number, number, number]

/**
 * The pixels of a PNG written by `make-icons.mjs`.
 *
 * Deliberately only handles what that script emits — 8-bit RGBA, no
 * interlacing, filter 0 on every scanline — and asserts each of those rather
 * than implementing the rest of the format. If the encoder ever starts
 * filtering, this fails loudly instead of reading noise.
 */
function decode(file: string) {
  const bytes = readFileSync(fileURLToPath(new URL(file, PUBLIC)))
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  let header: { width: number; height: number } | undefined
  const data: Buffer[] = []

  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString('latin1', at + 4, at + 8)
    const chunk = bytes.subarray(at + 8, at + 8 + length)

    if (type === 'IHDR') {
      expect(chunk[8], `${file}: bit depth`).toBe(8)
      expect(chunk[9], `${file}: colour type`).toBe(6) // RGBA
      expect(chunk[12], `${file}: interlacing`).toBe(0)
      header = { width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4) }
    }
    if (type === 'IDAT') data.push(chunk)

    at += 12 + length
  }

  expect(header, `${file}: no IHDR`).toBeDefined()
  const { width, height } = header!

  const raw = inflateSync(Buffer.concat(data))
  const rows: Pixel[][] = []
  let at = 0

  for (let y = 0; y < height; y++) {
    expect(raw[at++], `${file}: scanline ${y} filter`).toBe(0)
    const row: Pixel[] = []
    for (let x = 0; x < width; x++) {
      row.push([raw[at], raw[at + 1], raw[at + 2], raw[at + 3]])
      at += 4
    }
    rows.push(row)
  }

  return { width, height, rows }
}

/**
 * Every pixel, with where it sits: `radius` as a fraction of the width from
 * the centre, and `u`/`v` as offsets from the centre in the same units. `ink`
 * means the pixel is not the flat tile colour — the mark is there.
 */
function* scan(icon: ReturnType<typeof decode>) {
  const centre = (icon.width - 1) / 2
  for (let y = 0; y < icon.height; y++) {
    for (let x = 0; x < icon.width; x++) {
      const pixel = icon.rows[y][x]
      yield {
        x,
        y,
        pixel,
        ink: !TEAL.every((channel, i) => pixel[i] === channel),
        radius: Math.hypot(x - centre, y - centre) / icon.width,
        u: (x + 0.5) / icon.width - 0.5,
        v: (y + 0.5) / icon.height - 0.5,
      }
    }
  }
}

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('manifest.webmanifest', PUBLIC)), 'utf8'),
) as { icons: { src: string; sizes: string; purpose: string }[] }

const index = readFileSync(
  fileURLToPath(new URL('../../../index.html', import.meta.url)),
  'utf8',
)

describe('home-screen icons', () => {
  // apple-touch-icon is the iPhone one; the maskables are Android's.
  const maskable = ['icon-maskable-192.png', 'icon-maskable-512.png']
  const homeScreen = ['apple-touch-icon.png', ...maskable]

  it.each(homeScreen)('%s is opaque edge to edge', (file) => {
    const icon = decode(file)
    const transparent = [...scan(icon)].filter(({ pixel }) => pixel[3] !== 255)

    // Reported as a count and one example, because "1 pixel differs" and
    // "the whole background is missing" want very different responses.
    expect(
      { count: transparent.length, first: transparent[0] },
      `${file} has alpha; the platform composites that onto black`,
    ).toEqual({ count: 0, first: undefined })
  })

  it.each(maskable)('%s keeps its mark inside the safe zone', (file) => {
    const icon = decode(file)
    const outside = [...scan(icon)].filter(({ ink, radius }) => ink && radius > SAFE_RADIUS)

    expect(
      { count: outside.length, first: outside[0] },
      `${file} draws outside the middle 80%, which a launcher may crop`,
    ).toEqual({ count: 0, first: undefined })
  })

  it('the apple-touch-icon keeps its mark inside the shape iOS cuts', () => {
    // Deliberately checked against Apple's mask rather than SAFE_RADIUS: iOS
    // crops only the corners, so holding it to Android's safe circle would
    // shrink the mark on the platform that never needed it shrunk.
    const icon = decode('apple-touch-icon.png')
    const outside = [...scan(icon)].filter(({ ink, u, v }) => ink && !insideAppleMask(u, v))

    expect({ count: outside.length, first: outside[0] }).toEqual({
      count: 0,
      first: undefined,
    })
  })

  it('the apple-touch-icon in index.html is the one on disk, at the size iOS asks for', () => {
    expect(index).toContain('rel="apple-touch-icon" href="apple-touch-icon.png"')
    const icon = decode('apple-touch-icon.png')
    expect([icon.width, icon.height]).toEqual([180, 180])
  })

  it('gives the home screen a label short enough to survive it', () => {
    // iOS truncates at roughly eleven characters, and falls back to <title>,
    // which is "ACTAS OT Calculator".
    const title = index.match(/name="apple-mobile-web-app-title" content="([^"]*)"/)
    expect(title?.[1]).toBeDefined()
    expect(title![1].length).toBeLessThanOrEqual(12)
  })
})

describe('manifest icons', () => {
  it('declares each file at the size it actually is', () => {
    for (const { src, sizes } of manifest.icons) {
      const icon = decode(src)
      expect(`${icon.width}x${icon.height}`, `${src} in the manifest`).toBe(sizes)
    }
  })

  it('offers a maskable icon at both sizes Chrome looks for', () => {
    const maskable = manifest.icons
      .filter((icon) => icon.purpose === 'maskable')
      .map((icon) => icon.sizes)

    // With only a 512, a launcher downscales for every density; with none at
    // all, Chrome shrinks the "any" icon onto a white circle instead.
    expect(maskable.sort()).toEqual(['192x192', '512x512'])
  })

  it('keeps the "any" icons rounded, which is why they are a separate purpose', () => {
    // These are drawn *on* a surface — a tab strip, a task switcher, the
    // splash screen — where a full-bleed square would look like a bug. If this
    // ever fails alongside the opacity tests passing, someone has made every
    // icon full-bleed and the app has lost its rounded mark everywhere.
    for (const { src } of manifest.icons.filter((icon) => icon.purpose === 'any')) {
      const icon = decode(src)
      expect(icon.rows[0][0][3], `${src} corner`).toBe(0)
      expect(icon.rows[Math.floor(icon.height / 2)][0][3], `${src} edge midpoint`).toBe(255)
    }
  })
})
