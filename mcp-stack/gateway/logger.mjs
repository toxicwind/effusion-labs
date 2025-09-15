// Minimal JSON logger with {ts, level, comp, server, msg, ...extra}
import fs from 'node:fs'
import path from 'node:path'

const levels = new Set(['debug', 'info', 'warn', 'error'])
const envLevel = process.env.LOG_LEVEL?.toLowerCase() || 'info'
const order = { debug: 10, info: 20, warn: 30, error: 40 }

let fileStream = null
function ensureLogFile() {
  try {
    const dir = path.join(process.cwd(), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'gateway.jsonl')
    if (!fileStream) fileStream = fs.createWriteStream(file, { flags: 'a' })
  } catch {
    // ignore file errors, still log to stdout
  }
}

export function log(level, comp, msg, fields = {}) {
  const lvl = levels.has(level) ? level : 'info'
  if (order[lvl] < order[envLevel]) return
  const rec = {
    ts: new Date().toISOString(),
    level: lvl,
    comp,
    msg,
    ...fields,
  }
  const line = JSON.stringify(rec) + '\n'
  try {
    process.stdout.write(line)
  } catch {}
  try {
    ensureLogFile()
    if (fileStream) fileStream.write(line)
  } catch {}
}

export const banner = (lines = []) => {
  const bar = '═'.repeat(64)
  const body = [
    '\n\x1b[95m' + bar,
    ` HYPEBRUT :: mcp-stack gateway — ${new Date().toISOString()}`,
    ...lines,
    bar + '\x1b[0m\n',
  ]
  console.error(body.join('\n'))
}
