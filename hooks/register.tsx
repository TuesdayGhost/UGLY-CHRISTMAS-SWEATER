import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { Sweater } from '../types'
import { makeColors } from './make-colors.js'
import { EMPTY, asSweater, dayOf, fresh, isFinished, knit, label, paneSvg, sceneSvg } from './sweater'

const PANE = 'sweater'
const SCENE = 'sweater'
const STORE = 'sweater'
const ALT = 'An ugly Christmas sweater being knitted, one row per tool call'

// Bump the tag when a Sweater's fields change: it declines what older code kept.
const sweater = atom({ plugin: 'ugly-christmas-sweater', key: 'sweater' } as const, EMPTY, {
  shape: 'sweater-1',
})

// Wool white and cranberry by day; pine and candlelight by night.
const { theme, problems } = makeColors({
  label: 'Ugly Christmas sweater',
  roles: { accent: '#b8232f', danger: '#e03131', success: '#2f8f5b', warning: '#d4a017', pro: '#8e4585' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#efe6d6',
        'surface-1': '#f4ecde',
        'surface-2': '#faf5ea',
        'text-primary': '#2b1d1a',
        'text-secondary': '#56423a',
        'text-muted': '#6c5a50',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#13241b',
        'surface-1': '#192c22',
        'surface-2': '#1f3429',
        'surface-3': '#253b2f',
        'text-primary': '#f3ecdc',
        'text-secondary': '#d3cab6',
        'text-muted': '#aeb3a0',
      },
    },
  },
})

// A light frost: the sweater sits behind the words, so the stitches should
// still read as stitches under the panels.
const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE, glass: { blur: 2, opacity: 0.66 } },
}

// Every change goes through here, so midnight is noticed before any of them:
// yesterday's sweater is put away and the change lands on a new one.
async function change(
  $: EngineInterface,
  timeZone: string,
  fn: (s: Sweater) => Sweater,
): Promise<void> {
  const day = dayOf(await $.clock.now(), timeZone)
  const before = await read($, sweater)
  const today = (s: Sweater): Sweater => (s.day === day ? s : fresh(day, 1, s.tacky))

  if (fn(today(before)) === before) {
    return
  }
  const after = await update($, sweater, s => fn(today(s)))
  await $.store.set(STORE, after)

  if (before.day !== '' && before.day !== day) {
    $.ui.toast('🧶 日付が変わりました。新しいセーターを編み始めます')
  } else if (isFinished(after) && !isFinished(before)) {
    $.ui.toast(`🎄 本日${after.no}枚目のアグリーセーター、完成!`)
  }
}

export const register: Register = (on, options) => {
  const timeZone = typeof options.timeZone === 'string' ? options.timeZone : ''

  on('session.start', async ($, e, next) => {
    // Today's sweater carries on from wherever another session left it.
    const kept = asSweater(await $.store.get(STORE))
    const { context } = await $.session.usage()
    const tacky = context.percent ?? 0

    await change($, timeZone, s => {
      const base = s.rows === 0 && s.no === 1 && kept !== undefined && kept.day === s.day ? kept : s

      return base === s && s.tacky === tacky ? s : { ...base, tacky, shed: 0 }
    })

    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    await $.theme.set(LOOK)
    await $.command.register({
      name: 'sweater',
      description: '今日のアグリー・クリスマス・セーターをペインで見る',
    })
    // Midnight comes whether or not a tool runs.
    $.clock.every(60_000, () => void change($, timeZone, s => s))

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    try {
      const hasFailed = ran.deny !== undefined || ran.isError === true

      await change($, timeZone, s => knit(s, String(e.tool), hasFailed))
    } catch {
      // A dropped stitch of our own never costs the tool its result.
    }

    return ran
  })

  // The fuller the context, the more gets pinned on.
  on('session.measure', async ($, e, next) => {
    const tacky = e.context.percent

    if (tacky !== undefined) {
      await change($, timeZone, s => (s.tacky === tacky && s.shed === 0 ? s : { ...s, tacky, shed: 0 }))
    }

    return next(e)
  })

  // /compact shakes the lot off.
  on('session.compact', async ($, e, next) => {
    const done = await next(e)

    if (done.skip === undefined && e.trigger !== 'precompute' && e.agentId === undefined) {
      await change($, timeZone, s => (s.tacky === 0 ? s : { ...s, shed: s.tacky, tacky: 0 }))
    }

    return done
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      await change($, timeZone, s => (s.tacky === 0 ? s : { ...s, shed: s.tacky, tacky: 0 }))
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    const isOurs = e.props.plugin === $.plugin.name && e.props.scene === SCENE

    if (!isOurs || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={sceneSvg(await read($, sweater))} alt={ALT} isInteractive />
  })

  on('command.run', { command: 'sweater' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Ugly Christmas Sweater' })

    return { text: label(await read($, sweater)) }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = await read($, sweater)

    if (e.surface === 'terminal') {
      const { Text } = $.ui.resolve(e)

      return <Text>{label(s)}</Text>
    }
    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Svg source={paneSvg(s)} alt={`${ALT}: ${label(s)}`} isInteractive />
        <Text dimColor>{label(s)}</Text>
      </Box>
    )
  })
}
