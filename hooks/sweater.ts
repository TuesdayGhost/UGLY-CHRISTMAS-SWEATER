// The sweater itself: its shape, how a tool call knits a row, and the SVG.
// Pure: nothing here touches `$`, so it runs anywhere.
import type { Band, Snag, Sweater } from '../types'

// One stitch is one cell. The sweater lies flat, sleeves out, knitted top-down.
export const W = 96
export const H = 52
const CX = W / 2
const BODY = 20 // half the body's width
const HEM = 48 // the body's ribbing starts here
const CUFF = 41
const SLEEVE_END = 44
const SLEEVE_W = 12
const NECK = [7, 6, 4]
const COLLAR = [9, 8, 7, 5]

// Christmas yarns first, then the ones nobody should have bought.
export const YARNS = [
  '#c8102e', '#0b7a3b', '#f4efe4', '#1d3a7a', '#e0a800',
  '#ff5fa2', '#18b6b0', '#7b3fb5', '#f26b1d', '#9bd400',
]

const luminance = (hex: string): number => {
  const n = parseInt(hex.slice(1), 16)

  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
const LUM = YARNS.map(luminance)

const chevron = (period: number, rows: number): string[] =>
  Array.from({ length: rows }, (_, y) =>
    Array.from({ length: period }, (_, c) => {
      const k = Math.min(c, period - c)

      return k === y ? '#' : k === y - 2 ? '+' : '.'
    }).join(''),
  )

const diamond = (): string[] =>
  Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 8 }, (_, c) => {
      const k = Math.abs(c - 4) + Math.abs(y - 3)

      return k === 3 ? '#' : k <= 1 ? '+' : '.'
    }).join(''),
  )

// '#' is the band's main yarn, '+' its accent. A row repeats outward from the
// centre line and is mirrored across it, so every band is symmetric.
export const MOTIFS: Record<string, string[]> = {
  zigzag: chevron(8, 6),
  snowflake: [
    '....#....',
    '..#.#.#..',
    '...###...',
    '.###+###.',
    '...###...',
    '..#.#.#..',
    '....#....',
  ],
  tree: [
    '....+....',
    '....#....',
    '...###...',
    '..#####..',
    '...###...',
    '..#####..',
    '.#######.',
    '....+....',
  ],
  gift: [
    '..++.++..',
    '...+++...',
    '.###+###.',
    '.###+###.',
    '.+++++++.',
    '.###+###.',
    '.###+###.',
  ],
  reindeer: [
    '.#.#........',
    '.###........',
    '..#.........',
    '+###....#...',
    '..#########.',
    '..########..',
    '..#.#..#.#..',
    '..#.#..#.#..',
  ],
  diamond: diamond(),
  star: [
    '....#....',
    '...###...',
    '.#######.',
    '..#####..',
    '...###...',
    '..##.##..',
    '..#...#..',
  ],
  bell: [
    '....+....',
    '...###...',
    '...###...',
    '..#####..',
    '.#######.',
    '....+....',
  ],
  gingerbread: [
    '...###...',
    '...###...',
    '.#######.',
    '...#+#...',
    '...#+#...',
    '..##.##..',
    '..#...#..',
  ],
  heart: [
    '..##.##..',
    '.#######.',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
  candycane: [
    '..##...',
    '.+..+..',
    '....#..',
    '....+..',
    '....#..',
    '....+..',
  ],
  checker: ['##..', '##..', '..++', '..++'],
  stripes: ['#..+', '.#+.', '.+#.', '+..#'],
  xo: ['#.#..+.', '.#..+.+', '#.#..+.'],
}

const BY_TOOL: Record<string, string> = {
  Bash: 'zigzag',
  Read: 'snowflake',
  Edit: 'tree',
  NotebookEdit: 'tree',
  Write: 'gift',
  Grep: 'reindeer',
  Glob: 'diamond',
  WebSearch: 'star',
  WebFetch: 'bell',
  Agent: 'gingerbread',
  Task: 'gingerbread',
  Skill: 'heart',
  TodoWrite: 'checker',
}
const SPARE = ['heart', 'stripes', 'xo', 'checker', 'bell', 'star']

export const hash = (text: string): number => {
  let h = 2166136261

  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  }

  return h >>> 0
}

/** Which band a tool knits: a fixed motif per built-in, one by name for the rest. */
export const motifOf = (tool: string): string => {
  if (tool.startsWith('mcp__')) {
    return 'candycane'
  }

  return BY_TOOL[tool] ?? SPARE[hash(tool) % SPARE.length] ?? 'heart'
}

const rng = (seed: number): (() => number) => {
  let a = seed >>> 0

  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (next: () => number, n: number): number => Math.floor(next() * n)

export const EMPTY: Sweater = {
  day: '',
  seed: 0,
  no: 0,
  rows: 0,
  bands: [],
  snags: [],
  tacky: 0,
  shed: 0,
}

export const fresh = (day: string, no: number, tacky = 0): Sweater => ({
  ...EMPTY,
  day,
  no,
  seed: hash(`${day}#${no}`),
  tacky,
})

/** A stored value read back as a sweater, or nothing when it is not one. */
export const asSweater = (value: unknown): Sweater | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const s = value as Partial<Sweater>
  const isOne =
    typeof s.day === 'string' &&
    typeof s.seed === 'number' &&
    typeof s.no === 'number' &&
    typeof s.rows === 'number' &&
    Array.isArray(s.bands) &&
    Array.isArray(s.snags) &&
    s.bands.every(b => MOTIFS[b.motif] !== undefined)

  return isOne ? { ...EMPTY, ...s } as Sweater : undefined
}

/** The local date at `ms`, `YYYY-MM-DD`, in `timeZone` or the machine's own. */
export const dayOf = (ms: number, timeZone: string): string => {
  const at = new Date(ms)

  if (timeZone !== '') {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(at)
    } catch {
      // An unknown zone falls back to the machine's.
    }
  }
  const two = (n: number): string => String(n).padStart(2, '0')

  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`
}

const heightOf = (band: Band): number => (MOTIFS[band.motif]?.length ?? 0) + 3
const knittedBy = (bands: Band[]): number =>
  bands.reduce((sum, band) => sum + heightOf(band), 0)

const newBand = (s: Sweater, tool: string): Band => {
  const next = rng(s.seed ^ Math.imul(s.bands.length + 1, 0x9e3779b1))
  const before = s.bands.at(-1)
  let bg = pick(next, YARNS.length)

  while (bg === before?.bg) {
    bg = pick(next, YARNS.length)
  }
  // A motif nobody can see is not ugly, only blank: keep the yarns apart.
  const clear = YARNS.map((_, i) => i).filter(
    i => Math.abs((LUM[i] ?? 0) - (LUM[bg] ?? 0)) > 0.22,
  )
  const fg = clear[pick(next, clear.length)] ?? 2
  let ac = pick(next, YARNS.length)

  while (ac === bg || ac === fg) {
    ac = pick(next, YARNS.length)
  }

  return { motif: motifOf(tool), bg, fg, ac, trim: pick(next, 3) }
}

/**
 * One tool call knits one row. A call that finds the last band finished
 * starts the next in its own tool's motif; a failed one drops stitches.
 */
export const knit = (s: Sweater, tool: string, hasFailed: boolean): Sweater => {
  const from = s.rows >= H ? fresh(s.day, s.no + 1, s.tacky) : { ...s, shed: 0 }
  const isBandDone = from.rows >= knittedBy(from.bands)
  const bands =
    isBandDone && from.rows < HEM ? [...from.bands, newBand(from, tool)] : from.bands
  const row = from.rows
  let snags = from.snags

  if (hasFailed) {
    const next = rng(from.seed ^ Math.imul(row + 7, 0x85ebca6b))
    const w = 2 + pick(next, 2)
    const snag: Snag = {
      row,
      x: CX - 17 + pick(next, 34 - w),
      w,
      drop: 2 + pick(next, 3),
      yarn: bands.at(-1)?.fg ?? 2,
      len: 5 + pick(next, 6),
    }
    snags = [...snags, snag]
  }

  return { ...from, bands, snags, rows: row + 1 }
}

export const isFinished = (s: Sweater): boolean => s.rows >= H

// --- Drawing -------------------------------------------------------------

const dist = (x: number): number => (x >= CX ? x - CX : CX - 1 - x)

/** 0 off the sweater, 1 patterned knit, 2 ribbing (collar, cuffs, hem). */
const part = (x: number, r: number): 0 | 1 | 2 => {
  if (r < 0 || r >= H || x < 0 || x >= W) {
    return 0
  }
  const d = dist(x)

  if (d < (NECK[r] ?? 0)) {
    return 0
  }

  if (d < (COLLAR[r] ?? 0)) {
    return 2
  }

  if (d < BODY) {
    return r >= HEM ? 2 : 1
  }
  const outer = 23 + Math.floor(r * 0.5)

  if (r <= SLEEVE_END && d <= outer && d > outer - SLEEVE_W) {
    return r >= CUFF ? 2 : 1
  }

  return 0
}

type Placed = { band: Band; y: number }

const layout = (bands: Band[]): Placed[] =>
  bands.flatMap(band => Array.from({ length: heightOf(band) }, (_, y) => ({ band, y })))

const ribOf = (seed: number): [number, number] => {
  const a = seed % 2 // red or green: it is still a Christmas sweater
  const b = [2, 4, 5][(seed >>> 3) % 3] ?? 2

  return [a, b]
}

const yarnAt = (rows: Placed[], rib: [number, number], x: number, r: number): number => {
  if (part(x, r) === 2) {
    return x % 2 === 0 ? rib[0] : rib[1]
  }
  const placed = rows[r]

  if (placed === undefined) {
    return rib[0]
  }
  const { band, y } = placed
  const d = dist(x)

  if (y === 0) {
    return band.trim === 0 ? band.ac : band.trim === 1 ? (d % 2 === 0 ? band.ac : band.fg) : d % 4 < 2 ? band.ac : band.bg
  }
  const line = MOTIFS[band.motif]?.[y - 2]

  if (line === undefined) {
    return band.bg
  }
  const stitch = line[d % line.length]

  return stitch === '#' ? band.fg : stitch === '+' ? band.ac : band.bg
}

const n1 = (n: number): string => String(Math.round(n * 10) / 10)

/** Where trim can be pinned: a patterned stitch, the same one for a given seed. */
const spot = (next: () => number): [number, number] => {
  for (let i = 0; i < 40; i++) {
    const x = pick(next, W)
    const r = 5 + pick(next, 42)

    if (part(x, r) === 1 && part(x - 2, r) === 1 && part(x + 2, r) === 1) {
      return [x + 0.5, r + 0.5]
    }
  }

  return [CX, 24]
}

const POM = ['#ffffff', '#ff3b3b', '#ffe14a', '#ff8ad8', '#6fe3ff', '#b7ff5a']
const TINSEL = ['#ffd54a', '#e9e9f5', '#ff4fd8', '#39e6ff']
const BULB = ['#ff3030', '#ffd21f', '#2f8bff', '#3ddc5a', '#ff66d0']

/**
 * Everything pinned on at a given context fill, one markup string per piece.
 * A piece keeps its place as the fill rises, and shows only on knitted rows.
 */
const trimmings = (seed: number, tacky: number, rows: number): string[] => {
  const out: string[] = []
  const count = (from: number, per: number, most: number): number =>
    Math.max(0, Math.min(most, Math.floor((tacky - from) / per) + 1))

  // Tinsel: swags across the chest.
  const tinselRows = [13, 27, 37, 20]

  for (let i = 0; i < (tacky >= 35 ? count(35, 15, 4) : 0); i++) {
    const y = tinselRows[i] ?? 13

    if (y + 4 <= rows) {
      const d = `M${CX - 19} ${y}Q${CX} ${y + 8} ${CX + 19} ${y}`
      const color = TINSEL[(i + seed) % TINSEL.length]

      out.push(
        `<g class="shimmer" fill="none" stroke-linecap="round"><path d="${d}" stroke="${color}" stroke-width="1.1" stroke-dasharray=".4 .28"/>` +
          `<path d="${d}" stroke="${color}" stroke-width="2.4" stroke-dasharray=".14 .5" opacity=".8"/><path d="${d}" stroke="#fff" stroke-width="1.9" stroke-dasharray=".1 1.7" opacity=".8"/></g>`,
      )
    }
  }

  // Pom-poms, from the very start.
  const poms = rng(seed ^ 0x51ed)

  for (let i = 0; i < (tacky >= 8 ? count(8, 5, 18) : 0); i++) {
    const [x, y] = spot(poms)
    const color = POM[pick(poms, POM.length)]

    if (y + 2 <= rows) {
      out.push(
        `<g transform="translate(${x} ${y})"><circle r="1.7" fill="${color}"/><circle r="1.7" fill="none" stroke="#fff" stroke-width=".7" stroke-dasharray=".22 .3" opacity=".7"/><circle cx="-.5" cy="-.5" r=".5" fill="#fff" opacity=".5"/></g>`,
      )
    }
  }

  // Jingle bells.
  const bells = rng(seed ^ 0xbe11)

  for (let i = 0; i < (tacky >= 20 ? count(20, 6, 12) : 0); i++) {
    const [x, y] = spot(bells)

    if (y + 2 <= rows) {
      out.push(
        `<g transform="translate(${x} ${y})"><g class="ring" style="animation-delay:-${i * 370}ms"><circle cy="-1.7" r=".45" fill="none" stroke="#a67c00" stroke-width=".25"/><circle r="1.4" fill="#f2c230" stroke="#a67c00" stroke-width=".2"/><path d="M-1 .35h2" stroke="#7a5a00" stroke-width=".28"/><circle cy=".9" r=".32" fill="#7a5a00"/><circle cx="-.5" cy="-.55" r=".35" fill="#fff8d0"/></g></g>`,
      )
    }
  }

  // Fairy lights: a wire and blinking bulbs.
  const lightRows = [8, 31, 21, 41]

  for (let i = 0; i < (tacky >= 55 ? count(55, 12, 4) : 0); i++) {
    const y = lightRows[i] ?? 8

    if (y + 4 <= rows) {
      const [x0, x1, sag] = [CX - 21, CX + 21, y + 7]
      let bulbs = ''

      for (let k = 0; k <= 12; k++) {
        const t = k / 12
        const bx = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * CX + t * t * x1
        const by = (1 - t) * (1 - t) * y + 2 * t * (1 - t) * sag + t * t * y
        const color = BULB[(k + i) % BULB.length]

        bulbs += `<g class="blink b${(k + i) % 3}"><circle cx="${n1(bx)}" cy="${n1(by + 0.9)}" r="2.3" fill="${color}" opacity=".3"/><ellipse cx="${n1(bx)}" cy="${n1(by + 0.9)}" rx=".75" ry="1.05" fill="${color}"/></g>`
      }
      out.push(
        `<g><path d="M${x0} ${y}Q${CX} ${sag} ${x1} ${y}" fill="none" stroke="#12301c" stroke-width=".32"/>${bulbs}</g>`,
      )
    }
  }

  // Past 80%: the sweater gets a face.
  if (tacky >= 80 && rows >= 27) {
    out.push(
      `<g transform="translate(${CX} 22)"><circle r="3.3" fill="#e5121d"/><circle cx="-1" cy="-1.1" r=".9" fill="#fff" opacity=".7"/></g>`,
      `<g transform="translate(${CX - 5} 15)"><circle r="2.2" fill="#fff" stroke="#222" stroke-width=".2"/><circle class="googly" cy=".7" r="1" fill="#111"/></g>`,
      `<g transform="translate(${CX + 5} 15)"><circle r="2.2" fill="#fff" stroke="#222" stroke-width=".2"/><circle class="googly" cy=".7" r="1" fill="#111" style="animation-delay:-.4s"/></g>`,
    )
  }

  return out
}

const STYLE =
  '.blink{animation:blink 1.5s steps(1) infinite}.b1{animation-delay:-.5s}.b2{animation-delay:-1s}' +
  '@keyframes blink{0%,66%{opacity:1}67%,100%{opacity:.25}}' +
  '.shimmer{animation:shimmer 2.2s ease-in-out infinite}@keyframes shimmer{50%{opacity:.7}}' +
  '.ring{animation:ring 1.8s ease-in-out infinite;transform-origin:0 -1.7px}@keyframes ring{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}' +
  '.googly{animation:googly 1.1s ease-in-out infinite}@keyframes googly{0%,100%{transform:translate(-.7px,0)}50%{transform:translate(.7px,-.5px)}}' +
  '.fall{animation:fall 1.7s cubic-bezier(.5,0,1,.6) forwards}@keyframes fall{15%{transform:translateY(-1.5px)}100%{transform:translate(3px,70px) rotate(25deg);opacity:0}}' +
  '.sway{animation:sway 3s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 0}@keyframes sway{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}' +
  '@media (prefers-reduced-motion:reduce){.blink,.shimmer,.ring,.googly,.sway{animation:none}.fall{animation:none;opacity:0}}'

/** The sweater's own drawing, in stitch units: x 0 to 96, y about -4 to 62. */
const drawing = (s: Sweater): string => {
  const rows = layout(s.bands)
  const rib = ribOf(s.seed)
  const holes = new Set<string>()

  for (const snag of s.snags) {
    for (let k = 0; k < snag.drop; k++) {
      for (let x = snag.x; x < snag.x + snag.w; x++) {
        holes.add(`${x},${snag.row + k}`)
      }
    }
  }
  const byYarn: string[] = YARNS.map(() => '')
  let knitted = ''
  let ghost = ''

  for (let r = 0; r < H; r++) {
    let x = 0

    while (x < W) {
      if (part(x, r) === 0 || (r < s.rows && holes.has(`${x},${r}`))) {
        x += 1
        continue
      }
      const from = x

      if (r >= s.rows) {
        while (x < W && part(x, r) !== 0) {
          x += 1
        }
        ghost += `M${from} ${r}h${x - from}`
        continue
      }
      const yarn = yarnAt(rows, rib, x, r)

      while (x < W && part(x, r) !== 0 && !holes.has(`${x},${r}`) && yarnAt(rows, rib, x, r) === yarn) {
        x += 1
      }
      byYarn[yarn] += `M${from} ${r}h${x - from}`
      knitted += `M${from} ${r}h${x - from}`
    }
  }
  let out =
    '<defs><pattern id="v" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M.12 .05L.5 .95L.88 .05" fill="none" stroke="#000" stroke-opacity=".28" stroke-width=".16"/><path d="M.5 .95V.6" stroke="#fff" stroke-opacity=".12" stroke-width=".1"/></pattern></defs>'

  // Rows still to come: a dotted outline of where the sweater will be.
  out += `<path d="${ghost}" transform="translate(0 .5)" fill="none" stroke="#8a8a8a" stroke-opacity=".3" stroke-width=".28" stroke-dasharray=".28 .72" stroke-dashoffset="-.36"/>`
  out += '<g transform="translate(0 .5)" fill="none" stroke-width="1.03" shape-rendering="crispEdges">'
  byYarn.forEach((d, i) => {
    if (d !== '') {
      out += `<path d="${d}" stroke="${YARNS[i]}"/>`
    }
  })
  out += '</g>'
  out += `<path d="${knitted}" transform="translate(0 .5)" fill="none" stroke="url(#v)" stroke-width="1"/>`

  // Dropped stitches: rungs across the ladder, and the end that came loose.
  for (const snag of s.snags) {
    if (snag.row >= s.rows) {
      continue
    }
    const color = YARNS[snag.yarn]
    const [left, right] = [snag.x - 0.2, snag.x + snag.w + 0.2]
    let rungs = ''

    for (let k = 1; k < snag.drop && snag.row + k < s.rows; k++) {
      rungs += `M${left} ${snag.row + k + 0.5}h${right - left}`
    }
    const [x, y] = [snag.x + snag.w / 2, snag.row + 0.8]
    let loose = `M${n1(left)} ${n1(y - 0.3)}Q${n1(x)} ${n1(y + 1.6)} ${n1(x)} ${n1(y + 1.2)}`

    for (let k = 0; k < snag.len; k++) {
      loose += `q${k % 2 === 0 ? 1.1 : -1.1} .6 0 1.2`
    }
    out +=
      `<path d="${rungs}" fill="none" stroke="${color}" stroke-width=".22" opacity=".85"/>` +
      `<g class="sway"><path d="${loose}q.9 .5 .3 1.1" fill="none" stroke="${color}" stroke-width=".42" stroke-linecap="round"/></g>`
  }

  // Trimmings: what is on now, or what a compaction just shook off.
  if (s.shed > 0) {
    out += trimmings(s.seed, s.shed, s.rows)
      .map((piece, i) => `<g class="fall" style="animation-delay:${(i * 53) % 700}ms">${piece}</g>`)
      .join('')
  } else {
    out += trimmings(s.seed, s.tacky, s.rows).join('')
  }

  // The needle under the last row, and the yarn running off to its ball.
  if (s.rows < H) {
    let [lo, hi] = [W, 0]

    for (let x = 0; x < W; x++) {
      if (part(x, s.rows) !== 0) {
        lo = Math.min(lo, x)
        hi = Math.max(hi, x + 1)
      }
    }
    const y = s.rows + 0.35
    const yarn = YARNS[s.bands.at(-1)?.bg ?? rib[0]]

    out +=
      `<path d="M${hi + 1.5} ${y}C${hi + 9} ${y + 6} 84 54 88 57" fill="none" stroke="${yarn}" stroke-width=".42" stroke-linecap="round"/>` +
      `<path d="M${lo - 5} ${y + 0.5}L${hi + 2} ${y - 0.2}" stroke="#d9b68a" stroke-width=".75" stroke-linecap="round"/>` +
      `<circle cx="${lo - 5}" cy="${y + 0.5}" r=".85" fill="#b5895a"/>` +
      `<g><circle cx="89" cy="58" r="3.6" fill="${yarn}"/><path d="M86 57q3-3 6 0M86 59q3-3 6.4-.6M87.4 55.4q3 2 2.6 6" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".3"/></g>`
  }

  // Finished ones, folded in a pile.
  for (let i = 0; i < Math.min(s.no - 1, 7); i++) {
    const top = 59.5 - i * 1.7
    const a = YARNS[(s.seed + i * 3) % YARNS.length]
    const b = YARNS[(s.seed + i * 7 + 2) % YARNS.length]

    out += `<rect x="3" y="${n1(top)}" width="12" height="1.6" rx=".6" fill="${a}"/><path d="M4 ${n1(top + 0.8)}h10" stroke="${b}" stroke-width=".5" stroke-dasharray="1 1"/>`
  }
  out += `<text x="${CX}" y="57.5" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="2.1" fill="#8a8a8a">${label(s)}</text>`

  return out
}

/** One line on where the sweater stands. */
export const label = (s: Sweater): string =>
  s.day === ''
    ? 'まだ毛糸玉のまま'
    : `${s.day} · ${s.no}枚目 · ${Math.min(s.rows, H)}/${H}段${isFinished(s) ? ' 完成!' : ''}${s.snags.length > 0 ? ` · 穴${s.snags.length}` : ''} · ダサさ${Math.round(s.tacky)}%`

/** The sweater alone, for a pane. */
export const paneSvg = (s: Sweater): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -3 112 66" width="560" height="330"><style>${STYLE}</style>${drawing(s)}</svg>`

/**
 * The backdrop: a wool ground over the whole window and the sweater large in
 * the middle, behind the words. Narrower boxes shrink it to fit their width.
 */
export const sceneSvg = (s: Sweater): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">' +
  `<style>${STYLE}` +
  '.ground{fill:#efe6d6}.purl{stroke:#b9a88c}' +
  '@media (prefers-color-scheme:dark){.ground{fill:#13241b}.purl{stroke:#3d5a48}}' +
  '.sw{transform:translate(260px,165px)}' +
  '@media (max-aspect-ratio:1/1){.sw{transform:translate(368px,170px) scale(.8)}}' +
  '@media (max-aspect-ratio:3/4){.sw{transform:translate(465px,175px) scale(.62)}}' +
  '@media (max-aspect-ratio:3/5){.sw{transform:translate(530px,180px) scale(.5)}}' +
  '@media (max-aspect-ratio:1/2){.sw{transform:translate(584px,185px) scale(.4)}}' +
  '</style>' +
  '<defs><pattern id="wool" width="18" height="16" patternUnits="userSpaceOnUse"><path class="purl" d="M2 2L9 13L16 2" fill="none" stroke-width="2.2" stroke-linecap="round" opacity=".22"/></pattern></defs>' +
  '<rect class="ground" width="1600" height="1000"/><rect width="1600" height="1000" fill="url(#wool)"/>' +
  `<g class="sw"><svg width="1080" height="636" viewBox="-8 -3 112 66">${drawing(s)}</svg></g>` +
  '</svg>'
