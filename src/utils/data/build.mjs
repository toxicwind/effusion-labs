// src/utils/data/build.mjs
// Programmatic build metadata and FX snapshot with on-disk cache under .cache/
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CACHE_DIR = path.join(process.cwd(), '.cache')
const FX_FILE = path.join(CACHE_DIR, 'fx.json')

async function getFx(base = 'USD') {
  try {
    const raw = await readFile(FX_FILE, 'utf8')
    const json = JSON.parse(raw)
    const ageMs = Date.now() - new Date(json.saved_at).getTime()
    if (ageMs < 24 * 60 * 60 * 1000 && json.base === base) return json
  } catch {}

  async function frankfurter() {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`, {
      headers: { 'user-agent': 'Effusion-FX' },
      timeout: 6000,
    })
    if (!res.ok) throw new Error('frankfurter failed')
    const d = await res.json()
    return {
      base,
      rates: d.rates || {},
      date: d.date || new Date().toISOString().slice(0, 10),
    }
  }

  async function fawwaz() {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`,
      { timeout: 6000 },
    )
    if (!res.ok) throw new Error('fawwaz failed')
    const d = await res.json()
    const key = Object.keys(d)[0]
    const map = {}
    for (const [k, v] of Object.entries(d[key] || {})) map[k.toUpperCase()] = v
    return { base, rates: map, date: new Date().toISOString().slice(0, 10) }
  }

  let fx = { base, rates: {}, date: null }
  try {
    fx = await frankfurter()
  } catch {
    try {
      fx = await fawwaz()
    } catch {}
  }

  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(
      FX_FILE,
      JSON.stringify({ ...fx, saved_at: new Date().toISOString() }, null, 2),
    )
  } catch {}

  return fx
}

export async function buildGlobals() {
  const baseCurrency = process.env.FX_BASE?.toUpperCase?.() || 'USD'
  const fx = await getFx(baseCurrency)
  const commit = process.env.COMMIT_REF
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || null
  const version = process.env.npm_package_version || null
  return {
    hash: commit,
    commit,
    version,
    date: new Date().toISOString(),
    base_currency: baseCurrency,
    fx: fx.rates || {},
    fx_asof: fx.date || null,
  }
}

export default { buildGlobals }
