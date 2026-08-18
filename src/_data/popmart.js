// src/_data/popmart.js — Popmart recon data pipeline
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const POPMART_DATA_DIR = path.join(projectRoot, 'services')

async function loadPopmartData() {
  try {
    // Look for latest popmart_recon_v3_*.json file
    const files = await fs.readdir(POPMART_DATA_DIR)
    const popmartFiles = files
      .filter(f => f.startsWith('popmart_recon_v3_') && f.endsWith('.json'))
      .sort()
      .reverse()

    if (popmartFiles.length === 0) {
      console.warn('[popmart] No recon data found, using empty dataset')
      return { records: [], summary: { total: 0, live: 0, interesting: 0 }, timestamp: null }
    }

    const latestFile = path.join(POPMART_DATA_DIR, popmartFiles[0])
    const raw = await fs.readFile(latestFile, 'utf8')
    const records = JSON.parse(raw)

    // Compute summary stats
    const live = records.filter(r => r.http_status === 200)
    const interesting = live.filter(r =>
      r.found_price || r.launch_hint || (r.jsonld_names && r.jsonld_names.length > 0)
    )

    // Group by context
    const byContext = records.reduce((acc, r) => {
      const ctx = r.context || 'unknown'
      if (!acc[ctx]) acc[ctx] = []
      acc[ctx].push(r)
      return acc
    }, {})

    return {
      records,
      liveRecords: live,
      interestingRecords: interesting,
      byContext,
      summary: {
        total: records.length,
        live: live.length,
        interesting: interesting.length,
        contexts: Object.keys(byContext).length,
      },
      timestamp: popmartFiles[0].match(/(\\d{8}_\\d{6})/)?.[1] || null,
    }
  } catch (error) {
    console.error('[popmart] Failed to load data:', error?.message || error)
    return { records: [], summary: { total: 0, live: 0, interesting: 0 }, timestamp: null }
  }
}

export default async function() {
  return await loadPopmartData()
}
