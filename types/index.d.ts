/** One patterned band: a motif and the three yarns it is knitted in. */
export type Band = { motif: string; bg: number; fg: number; ac: number; trim: number }

/** Dropped stitches from a failed tool call: a hole, a ladder under it, a loose end. */
export type Snag = { row: number; x: number; w: number; drop: number; yarn: number; len: number }

/** A finished sweater kept to hang up: what it takes to draw its knitting again. */
export type Hung = { seed: number; bands: Band[]; snags: Snag[] }

export type Sweater = {
  /** The local date it belongs to, `YYYY-MM-DD`; empty before the first one. */
  day: string
  seed: number
  /** Which sweater of the day this is, from 1. */
  no: number
  /** Rows knitted so far, from the collar down. */
  rows: number
  bands: Band[]
  snags: Snag[]
  /** The day's finished sweaters on the rail, oldest first: the last few only. */
  hung: Hung[]
  /** Context fill, 0 to 100: how much is pinned on. */
  tacky: number
  /** The fill the decorations had when a compaction shook them off; 0 otherwise. */
  shed: number
}

declare module 'claude-code' {
  interface PluginState {
    'ugly-christmas-sweater': { sweater: Shaped<Sweater> }
  }
}
