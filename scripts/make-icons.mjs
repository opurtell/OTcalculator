/**
 * Draws the app icons. `node scripts/make-icons.mjs`.
 *
 * The favicon is an inline SVG data URI in index.html, which is all a browser
 * tab needs — but a web app manifest wants raster icons, and iOS wants an
 * apple-touch-icon or it screenshots the page instead. Rather than add an
 * image dependency to a project whose whole point is having none, this draws
 * the same mark directly and encodes the PNG by hand: `node:zlib` supplies the
 * only hard part, and PNG's structure is four chunks and a CRC.
 *
 * Output is committed to `public/`, so this only needs running when the mark
 * changes. Keep it in step with the favicon in index.html.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The mark, in the favicon's own 32-unit coordinate space: a rounded square in
// --teal with three rules on it in --paper. Three lines, decreasing — a ledger
// page, which is the whole design language (DESIGN_BRIEF.md §3).
const TEAL = [0x17, 0x6b, 0x6b]
const PAPER = [0xf7, 0xf5, 0xf0]
const UNITS = 32
const CORNER = 6
const BARS = [
  { x0: 8, x1: 24, y: 11 },
  { x0: 8, x1: 24, y: 17 },
  { x0: 8, x1: 17, y: 23 },
]
const BAR_RADIUS = 1.25 // stroke-width 2.5, round cap

/** Signed distance to a rounded rectangle centred on the tile. */
function roundedRectDistance(x, y, half, radius) {
  const dx = Math.abs(x - half) - (half - radius)
  const dy = Math.abs(y - half) - (half - radius)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - radius
}

/** Signed distance to a horizontal capsule — a stroked line with round caps. */
function barDistance(x, y, bar) {
  const clamped = Math.min(Math.max(x, bar.x0), bar.x1)
  return Math.hypot(x - clamped, y - bar.y) - BAR_RADIUS
}

/**
 * One pixel's colour, supersampled.
 *
 * 4×4 samples per pixel is enough for a flat two-colour mark: the only edges
 * are the tile's corners and the bar caps, and at 192px the largest artefact a
 * missed sample could leave is a sixteenth of a pixel.
 */
function pixel(px, py, size, inset) {
  const samples = 4
  let tile = 0
  let bar = 0

  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      // Sample centre, mapped back into the 32-unit space, with `inset`
      // shrinking the mark towards the middle for the maskable variant.
      const u = ((px + (sx + 0.5) / samples) / size) * UNITS
      const v = ((py + (sy + 0.5) / samples) / size) * UNITS
      const x = (u - UNITS / 2) / inset + UNITS / 2
      const y = (v - UNITS / 2) / inset + UNITS / 2

      if (roundedRectDistance(x, y, UNITS / 2, CORNER) <= 0) tile++
      if (BARS.some((b) => barDistance(x, y, b) <= 0)) bar++
    }
  }

  const total = samples * samples
  const tileAlpha = tile / total
  const barAlpha = bar / total
  // The bars sit on the tile, so composite them first, then apply the tile's
  // own coverage as the alpha channel — that is what keeps the corners smooth
  // against whatever the icon is drawn on.
  const rgb = TEAL.map((c, i) => Math.round(c * (1 - barAlpha) + PAPER[i] * barAlpha))
  return [...rgb, Math.round(tileAlpha * 255)]
}

/** CRC-32, as PNG specifies it. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** RGBA pixels in, a PNG file out. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // colour type: RGBA
  // 10–12: deflate compression, adaptive filtering, no interlacing — all zero.

  // Each scanline is prefixed with its filter type. Filter 0 (none) costs a
  // few hundred bytes on an icon this simple and keeps the encoder honest.
  const raw = Buffer.alloc(size * (1 + size * 4))
  let at = 0
  for (let y = 0; y < size; y++) {
    raw[at++] = 0
    for (let x = 0; x < size; x++) {
      for (const channel of pixels[y][x]) raw[at++] = channel
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function draw(size, inset) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) row.push(pixel(x, y, size, inset))
    rows.push(row)
  }
  return encodePng(size, rows)
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(out, { recursive: true })

const icons = [
  // The manifest's two sizes, plus the same mark at 180px for iOS, which does
  // not read the manifest and wants an apple-touch-icon link instead.
  { file: 'icon-192.png', size: 192, inset: 1 },
  { file: 'icon-512.png', size: 512, inset: 1 },
  { file: 'apple-touch-icon.png', size: 180, inset: 1 },
  // Maskable: Android crops icons to whatever shape the launcher uses, and
  // guarantees only the middle 80% survives. The mark shrinks to fit that safe
  // zone rather than losing its corners.
  { file: 'icon-maskable-512.png', size: 512, inset: 0.7 },
]

for (const { file, size, inset } of icons) {
  const png = draw(size, inset)
  writeFileSync(join(out, file), png)
  console.log(`${file} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} kB`)
}
