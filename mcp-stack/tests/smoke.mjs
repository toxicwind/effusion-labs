import { spawn } from 'node:child_process'
import { once } from 'node:events'

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function run() {
  const child = spawn(process.execPath, ['mcp-stack/gateway/server.mjs'], {
    env: { ...process.env, PORT_HTTP: '0', LOG_LEVEL: 'warn', PROFILE: 'dev' },
  })
  child.stderr.setEncoding('utf8')
  child.stdout.setEncoding('utf8')

  let port = 0
  const outLines = []
  child.stdout.on('data', c => {
    const parts = String(c).split(/\n+/)
    for (const line of parts) {
      if (!line.trim()) continue
      outLines.push(line)
      try {
        const obj = JSON.parse(line)
        if (obj.comp === 'startup' && obj.msg === 'listening') port = obj.port
      } catch {}
    }
  })
  child.stderr.on('data', c => {
    const txt = String(c)
    const m = txt.match(/\bPort:\s+(\d{2,5})/)
    if (m) port = Number(m[1])
  })
  // Wait up to 5s for port
  const t0 = Date.now()
  while (!port && Date.now() - t0 < 5000) await sleep(50)
  if (!port) throw new Error('did_not_find_port')

  const base = `http://127.0.0.1:${port}`
  const uServers = `${base}/servers`
  const r1 = await fetch(uServers)
  if (!r1.ok) throw new Error(`servers_not_ok ${r1.status}`)
  const { servers } = await r1.json()
  if (!Array.isArray(servers)) throw new Error('servers_invalid_shape')

  // Connect SSE demo
  const uSse = `${base}/servers/demo/sse`
  const res = await fetch(uSse, { headers: { Accept: 'text/event-stream' } })
  if (!res.ok) throw new Error(`sse_not_ok ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let got = ''
  const start = Date.now()
  while (Date.now() - start < 3000) {
    const { value, done } = await reader.read()
    if (done) break
    got += decoder.decode(value, { stream: true })
    if (got.includes('event: message') && got.includes('heartbeat')) break
  }
  if (!got.includes('heartbeat')) throw new Error('missing_heartbeat')

  child.kill('SIGTERM')
  await once(child, 'exit')
  console.log('SMOKE: pass')
}

run().catch(e => {
  console.error('SMOKE: fail', e)
  process.exit(1)
})
