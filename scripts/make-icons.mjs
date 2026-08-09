/**
 * Draws the app icons. `node scripts/make-icons.mjs`.
 *
 * The favicon is an inline SVG data URI in index.html, which is all a browser
 * tab needs — but a web app manifest wants raster icons, and iOS wants an
 * apple-touch-icon or it screenshots the page instead. Rather than add an
 * image dependency to a project whose whole point is having none, this draws
 * the mark directly and encodes the PNG by hand: `node:zlib` supplies the only
 * hard part, and PNG's structure is four chunks and a CRC.
 *
 * Everything is a signed distance field rather than a path, because that is
 * what can be rasterised in a page of arithmetic with no font and no image
 * library. It is also the constraint that shaped the mark: the dollar sign is
 * two arcs and a stroke, which is how a geometric $ is drawn anyway.
 *
 * The mark is emitted in two shapes, and which one an icon gets is not a
 * matter of taste — see the `icons` list at the bottom. Anything destined for
 * a home screen is masked again by the platform, so it has to be painted edge
 * to edge and keep its content in the middle; anything drawn *on* a surface
 * keeps the rounded, transparent-cornered tile.
 *
 * Output is committed to `public/`, so this only needs running when the mark
 * changes. Keep it in step with the favicon in index.html, and with
 * `src/ui/__tests__/icons.test.ts`, which holds the output to its contract.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const TEAL = [0x17, 0x6b, 0x6b] // --teal
const PAPER = [0xf5, 0xf7, 0xf5] // --paper
const UNITS = 32
const CORNER = 6

/* ---------- primitives, all signed distances in the 32-unit space ---------- */

const disc = (c, r) => (x, y) => Math.hypot(x - c[0], y - c[1]) - r

const ring = (c, r, w) => (x, y) => Math.abs(Math.hypot(x - c[0], y - c[1]) - r) - w / 2

/** A stroked line segment with round caps, at any angle. */
const stroke = (a, b, w) => (x, y) => {
  const vx = b[0] - a[0]
  const vy = b[1] - a[1]
  const px = x - a[0]
  const py = y - a[1]
  const t = Math.max(0, Math.min(1, (px * vx + py * vy) / (vx * vx + vy * vy || 1)))
  return Math.hypot(px - vx * t, py - vy * t) - w / 2
}

/** Screen angle in degrees: 0 is 3 o'clock, increasing clockwise — y is down. */
const angleAt = (x, y, c) => (Math.atan2(y - c[1], x - c[0]) * 180) / Math.PI

/** Is `a` inside the clockwise sweep from `from` to `to`? */
function withinSweep(a, from, to) {
  const norm = (d) => ((d % 360) + 360) % 360
  return norm(a - from) <= norm(to - from)
}

/** An arc of a ring, clockwise from `from` to `to`, with round caps. */
const arc = (c, r, from, to, w) => (x, y) => {
  if (withinSweep(angleAt(x, y, c), from, to)) {
    return Math.abs(Math.hypot(x - c[0], y - c[1]) - r) - w / 2
  }
  // Outside the sweep the nearest ink is one of the two caps.
  const cap = (deg) => {
    const rad = (deg * Math.PI) / 180
    return Math.hypot(x - (c[0] + r * Math.cos(rad)), y - (c[1] + r * Math.sin(rad))) - w / 2
  }
  return Math.min(cap(from), cap(to))
}

/**
 * A dollar sign: the top bowl open to the lower right, the bottom bowl open to
 * the upper left, and a stroke through both. Each bowl is 270° of a circle,
 * which is the geometric construction of an S and the only one expressible
 * here — a typeset $ would mean shipping a font to draw one glyph.
 */
const dollar = (c, r, w, overhang) => [
  arc([c[0], c[1] - r], r, 90, 0, w),
  arc([c[0], c[1] + r], r, -90, 180, w),
  stroke([c[0], c[1] - 2 * r - overhang], [c[0], c[1] + 2 * r + overhang], w),
]

/* ------------------------------- the mark -------------------------------- */

// A clock with a dollar badge: the hours, and what they are worth. The hands
// sit at twelve and just past it, which is the shape of an overrun.
//
// The badge is a paper disc held off the clock by a teal ring, and the $ is
// knocked back out of it in teal. That construction is deliberate: a badge is
// the only arrangement of two symbols tested here that stayed legible at 32px,
// because each shape keeps its own silhouette instead of tangling with the
// other's strokes.
const CLOCK = [13.2, 13.2]
const BADGE = [23, 23]
const BADGE_RADIUS = 7.6

const MARK = {
  paper: [
    ring(CLOCK, 9.8, 2.3),
    stroke(CLOCK, [13.2, 7.6], 2.3), // hour hand, at twelve
    stroke(CLOCK, [18.4, 15.4], 2.3), // minute hand, just past
    disc(BADGE, BADGE_RADIUS),
  ],
  // Knocked back out of the paper above, so the badge reads as a separate
  // object and the $ reads as a hole in it rather than an outline on it.
  teal: [ring(BADGE, BADGE_RADIUS + 1.4, 2.9), ...dollar(BADGE, 2.1, 1.7, 1.4)],
}

/** Signed distance to a rounded rectangle centred on the tile. */
function roundedRectDistance(x, y, half, radius) {
  const dx = Math.abs(x - half) - (half - radius)
  const dy = Math.abs(y - half) - (half - radius)
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - radius
}

const covers = (shapes, x, y) => shapes.some((shape) => shape(x, y) <= 0)

/**
 * One pixel's colour, supersampled.
 *
 * 4×4 samples per pixel is enough for a flat two-colour mark: every edge is a
 * circle, an arc or a round cap, and at 192px the largest artefact a missed
 * sample could leave is a sixteenth of a pixel.
 *
 * `bleed` paints the tile edge to edge instead of rounding it, and `content`
 * scales the mark about the centre so it can be stepped into a mask's safe
 * zone without the tile following it in.
 */
function pixel(px, py, size, { bleed, content }) {
  const samples = 4
  let tile = 0
  let paper = 0
  let teal = 0

  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      // Sample centre, mapped back into the 32-unit space.
      const x = ((px + (sx + 0.5) / samples) / size) * UNITS
      const y = ((py + (sy + 0.5) / samples) / size) * UNITS
      // The mark gets its own coordinates, scaled about the tile's centre.
      const mx = (x - UNITS / 2) / content + UNITS / 2
      const my = (y - UNITS / 2) / content + UNITS / 2

      if (bleed || roundedRectDistance(x, y, UNITS / 2, CORNER) <= 0) tile++
      if (covers(MARK.paper, mx, my)) paper++
      if (covers(MARK.teal, mx, my)) teal++
    }
  }

  const total = samples * samples
  const tileAlpha = tile / total
  const paperAlpha = Math.max(0, paper / total - teal / total)
  // The mark sits on the tile, so composite it first, then apply the tile's own
  // coverage as the alpha channel — that is what keeps the corners smooth
  // against whatever the icon is drawn on.
  const rgb = TEAL.map((c, i) => Math.round(c * (1 - paperAlpha) + PAPER[i] * paperAlpha))
  return [...rgb, Math.round(tileAlpha * 255)]
}

/* ------------------------------ PNG encoding ------------------------------ */

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

function draw(size, shape) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = []
    for (let x = 0; x < size; x++) row.push(pixel(x, y, size, shape))
    rows.push(row)
  }
  return encodePng(size, rows)
}

/* --------------------------------- output -------------------------------- */

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(out, { recursive: true })

// Rounded, transparent outside the corners, mark at full size: the favicon's
// own shape. This is for anywhere the icon is drawn *on* something — a tab
// strip, a task switcher, a splash screen — and it is the wrong shape for a
// home screen, where the platform masks it again.
const ROUNDED = { bleed: false, content: 1 }

// Full bleed for iOS. Safari composites a home-screen icon's alpha onto black
// before applying its own superellipse, so transparency here is only safe
// while our corner stays tighter than Apple's — at rx=6/32 it is (18.75%
// against about 22.4%), which is why the rounded version of this icon looked
// correct for a while. That is a coincidence of two numbers nobody is
// tracking. Full bleed has no alpha to composite, and the corner you see is
// the one iOS cuts, which is the one every other icon on the home screen has.
// iOS crops only the corners, so the mark barely steps in.
const APPLE = { bleed: true, content: 0.84 }

// Full bleed for Android, which crops a maskable icon to whatever shape the
// launcher uses and guarantees only the middle 80% survives. Two things follow
// and they are easy to conflate: the canvas must be painted to the edge, *and*
// the mark must fit the safe circle. Shrinking the whole tile does the second
// without the first, which is a small icon floating on a black square.
//
// This mark reaches the corners, so it needs a firmer step-in than a centred
// one would: at content 0.70 its furthest ink sits about 0.38 of the width
// from centre, inside the 0.40 the safe zone guarantees.
const MASKABLE = { bleed: true, content: 0.7 }

const icons = [
  { file: 'icon-192.png', size: 192, shape: ROUNDED },
  { file: 'icon-512.png', size: 512, shape: ROUNDED },
  { file: 'apple-touch-icon.png', size: 180, shape: APPLE },
  { file: 'icon-maskable-192.png', size: 192, shape: MASKABLE },
  { file: 'icon-maskable-512.png', size: 512, shape: MASKABLE },
]

for (const { file, size, shape } of icons) {
  const png = draw(size, shape)
  writeFileSync(join(out, file), png)
  console.log(`${file} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} kB`)
}
