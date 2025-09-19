// Stable unresolved link reporting with dedupe, schema, and *no CI gating* by default.

import fs from 'node:fs'
import path from 'node:path'

const OUT_PATH = path.join(
  'artifacts',
  'reports',
  'interlinker-unresolved.json',
)
const keyFor = (kind, key, sourcePage) => `${kind}::${key || ''}::${sourcePage || ''}`

const state = {
  map: new Map(), // key -> item
  count: 0,
}

function toISO(d = new Date()) {
  return new Date(d).toISOString()
}

export function recordUnresolved({
  kind,
  key,
  sourcePage,
  guessedKind,
  attemptedKinds,
}) {
  const k = keyFor(kind, key, sourcePage)
  if (!state.map.has(k)) {
    state.map.set(k, {
      kind,
      key: String(key ?? ''),
      sourcePage: sourcePage || null,
      guessedKind: guessedKind || null,
      attemptedKinds: Array.isArray(attemptedKinds) ? attemptedKinds : [],
      when: toISO(),
    })
    state.count++
  }
}

export function getUnresolvedItems() {
  return Array.from(state.map.values())
}

export function flushUnresolved() {
  const items = getUnresolvedItems()
  const payload = {
    schemaVersion: 1,
    generatedAt: toISO(),
    count: items.length,
    items,
  }
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2))
  return payload
}

// Simple logger-only summary. No thresholds, no throwing.
export function summarize({ log = true } = {}) {
  const payload = flushUnresolved()
  if (log) {
    // eslint-disable-next-line no-console
    console.log(`Interlinker: unresolved=${payload.count} → ${OUT_PATH}`)
  }
  return payload
}

// --- Optional legacy helper kept for flexibility; not used in config ---
function parseBool(v, fallback = false) {
  if (v == null) return fallback
  const s = String(v).toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}
function parseNum(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
export function summarizeAndGate() {
  const isCI = parseBool(process.env.CI, false)
  const defaultThreshold = isCI ? 200 : Infinity
  const maxUnresolved = parseNum(
    process.env.INTERLINKER_MAX_UNRESOLVED,
    defaultThreshold,
  )
  const shouldFail = parseBool(
    process.env.INTERLINKER_FAIL_ON_UNRESOLVED,
    false,
  )

  const payload = flushUnresolved()
  const count = payload.count
  const action = shouldFail && count > maxUnresolved ? 'fail' : 'warn'
  // eslint-disable-next-line no-console
  console.log(
    `Interlinker: unresolved=${count} threshold=${maxUnresolved} action=${action}`,
  )
  if (action === 'fail') {
    throw new Error(
      `Interlinker unresolved links (${count}) exceeded threshold (${maxUnresolved}).`,
    )
  }
}

// Auto-flush on exit so the report is always up-to-date
process.on('exit', () => {
  try {
    flushUnresolved()
  } catch {}
})
process.on('beforeExit', () => {
  try {
    flushUnresolved()
  } catch {}
})
process.on('SIGINT', () => {
  try {
    flushUnresolved()
  } catch {}
  process.exit(130)
})
process.on('SIGTERM', () => {
  try {
    flushUnresolved()
  } catch {}
  process.exit(143)
})
