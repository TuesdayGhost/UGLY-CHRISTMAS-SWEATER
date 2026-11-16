import type { SessionMessage } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { H, fresh, knit, motifOf, sceneSvg } from '../hooks/sweater'

const DAY = 24 * 60 * 60 * 1000
const SUMMARY: SessionMessage = { role: 'user', text: 'summary', toolUses: [] }
const BACKDROP = {
  plugin: 'ugly-christmas-sweater',
  component: 'Backdrop',
  requestId: 'backdrop',
  surface: 'desktop',
  props: { scene: 'sweater', plugin: 'ugly-christmas-sweater', glass: { blur: 3, opacity: 0.8 } },
} as const

test('each tool has its motif, and a full sweater fits an Svg', () => {
  expect(motifOf('Bash')).toBe('zigzag')
  expect(motifOf('Read')).toBe('snowflake')
  expect(motifOf('mcp__github__get_me')).toBe('candycane')

  let s = fresh('2026-12-24', 1, 100)

  for (let i = 0; i < H; i++) {
    s = knit(s, ['Bash', 'Read', 'Edit', 'Grep'][i % 4] ?? 'Bash', i % 3 === 0)
  }
  expect(s.rows).toBe(H)
  expect(s.snags.length).toBe(Math.ceil(H / 3))
  expect(sceneSvg(s).length).toBeLessThan(131072)
  // The row after a finished sweater casts on the next one.
  const next = knit(s, 'Bash', false)
  expect(next).toMatchObject({ no: 2, rows: 1 })
  // ...and the finished one goes up on the rail, at most four of them.
  expect(next.hung.length).toBe(1)
  expect(sceneSvg(next)).toContain('M40 -112H1040')
  const full = { ...next, hung: Array.from({ length: 4 }, () => next.hung[0]!), rows: H, bands: s.bands, snags: s.snags }
  expect(sceneSvg(full).length).toBeLessThan(131072)
})

test('rows, holes, trimmings, compaction and midnight', async ($, on) => {
  const clock = mock.clock(on, { now: 10 * DAY + 1000 })
  mock.store(on)
  let isFailing = false
  on('command.register', () => ({ value: { command: 'sweater' } }))
  on('theme.set', () => ({ value: { isDrawn: false, reason: 'test' } }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', () => ({ changed: ['context'] }))
  on('session.compact', () => ({ messages: [SUMMARY] }))
  on('tool.call', () => (isFailing ? { result: {}, isError: true } : { result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const drawn = async (): Promise<string> => {
    const ui = await $.ui.mount(BACKDROP)
    const svg = await ui.find({ type: 'Svg' })
    await ui.unmount()

    return String(svg?.props.source)
  }

  for (let i = 0; i < 30; i++) {
    await $.tool.call({ tool: 'Bash', command: 'ls' })
  }
  expect(await drawn()).toContain('30/52段')

  isFailing = true
  await $.tool.call({ tool: 'Bash', command: 'false' })
  expect(await drawn()).toContain('穴1')

  await $.session.measure({ context: { window: 200000, tokens: 120000, percent: 60 }, rateLimits: [], changed: ['context'] })
  expect(await drawn()).toContain('ダサさ60%')

  await $.session.compact({ trigger: 'manual', messages: [SUMMARY] })
  const shaken = await drawn()
  expect(shaken).toContain('ダサさ0%')
  expect(shaken).toContain('class="fall"')

  // The minute timer notices midnight with no tool running.
  await clock.advance(DAY)
  expect(await drawn()).toContain('0/52段')
})
