const HEARTBEAT_SECS = Number(process.env.LLM_HEARTBEAT_SECS ?? 15)
const MAX_MINS = Number(process.env.LLM_MAX_MINS ?? 30)

let sigints = 0
process.on('SIGINT', () => {
  sigints++
  if (sigints === 1) {
    try {
      process.stderr.write(
        '::warning:: LLM-safe: SIGINT received; ignoring first\n'
      )
    } catch {}
    return
  }
  try {
    process.stderr.write('::warning:: LLM-safe: second SIGINT; exiting (130)\n')
  } catch {}
  process.exit(130)
})

const hb = setInterval(
  () => {
    const line = `::notice:: LLM-safe: tests alive @ ${new Date().toISOString()}`
    try {
      process.stderr.write(line + '\n')
    } catch {}
  },
  Math.max(5, HEARTBEAT_SECS) * 1000
)
hb.unref?.()

const killer = setTimeout(
  () => {
    try {
      process.stderr.write(
        `::error:: LLM-safe: timeout ${MAX_MINS}m exceeded; exiting (124)\n`
      )
    } catch {}
    process.exit(124)
  },
  Math.max(1, MAX_MINS) * 60 * 1000
)
killer.unref?.()

process.once('beforeExit', () => {
  clearInterval(hb)
  clearTimeout(killer)
})
