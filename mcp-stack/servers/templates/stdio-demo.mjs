#!/usr/bin/env node
// Simple stdio JSONL demo server for gateway smoke tests.
// Reads JSON lines from stdin; writes heartbeat messages to stdout.
import { setInterval } from 'node:timers'

const name = process.argv[2] || 'demo'
let seq = 0

function write(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

write({
  type: 'hello',
  server: name,
  pid: process.pid,
  ts: new Date().toISOString(),
})

const hb = setInterval(() => {
  write({
    type: 'heartbeat',
    server: name,
    seq: ++seq,
    ts: new Date().toISOString(),
  })
}, 1000)

process.stdin.setEncoding('utf8')
let buf = ''
process.stdin.on('data', chunk => {
  buf += chunk
  let idx
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx)
    buf = buf.slice(idx + 1)
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      write({
        type: 'echo',
        server: name,
        recv: msg,
        ts: new Date().toISOString(),
      })
    } catch (e) {
      write({
        type: 'error',
        server: name,
        err: 'invalid_json',
        detail: e.message,
      })
    }
  }
})

process.on('SIGINT', () => {
  clearInterval(hb)
  process.exit(0)
})
process.on('SIGTERM', () => {
  clearInterval(hb)
  process.exit(0)
})
