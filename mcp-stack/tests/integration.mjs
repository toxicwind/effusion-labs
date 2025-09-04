import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as sleep } from "node:timers/promises";

async function getJSON(url, opts={}){
  const res = await fetch(url, opts);
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

function parsePort(stdout) {
  const lines = stdout.split(/\n+/).filter(Boolean);
  for (const line of lines) {
    try { const o = JSON.parse(line); if (o?.comp === 'startup' && o?.msg === 'listening') return o.port; } catch {}
  }
  return 0;
}

async function main(){
  const child = spawn(process.execPath, ["mcp-stack/gateway/server.mjs"], {
    env: { ...process.env, PROFILE: "dev", LOG_LEVEL: "info", PORT_HTTP: "0" },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let out = '';
  child.stdout.on('data', c=> out += String(c));
  let port = 0; const t0 = Date.now();
  while (!port && Date.now() - t0 < 5000) { await sleep(50); port = parsePort(out); }
  if(!port) throw new Error('no_port');
  const base = `http://127.0.0.1:${port}`;

  // 1) SSE framing
  {
    const res = await fetch(`${base}/servers/filesystem/sse`, { headers: { Accept: 'text/event-stream' } });
    if(!res.ok) throw new Error('sse_not_ok');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let got = '';
    const t1 = Date.now();
    while(Date.now() - t1 < 2500){
      const { value, done } = await reader.read();
      if (done) break;
      got += decoder.decode(value, { stream: true });
      if (got.includes('heartbeat')) break;
    }
    if(!(/^retry:\s*\d+/m.test(got))) throw new Error('missing_retry_header');
    if(!(/heartbeat/.test(got))) throw new Error('missing_heartbeat');
  }

  // 2) Child exit handling
  {
    // Find child pid from stream
    const r = await fetch(`${base}/servers/filesystem/sse`, { headers: { Accept: 'text/event-stream' } });
    const txt = await r.text();
    const m = txt.match(/\"pid\":(\d{2,})/);
    if(m){ try { process.kill(Number(m[1]), 'SIGKILL'); } catch{} }
    await sleep(400);
    const { json: man } = await getJSON(`${base}/.well-known/mcp-servers.json`);
    const fs = man.servers.find(s=>s.name==='filesystem');
    if(!fs || fs.health !== 'degraded') throw new Error('health_not_degraded');
  }

  // 3) Optional internet tests
  if (process.env.INTERNET_TESTS === '1') {
    const { json: r1 } = await getJSON(`${base}/servers/readweb/info`, { method:'POST', body: JSON.stringify({ url:'https://example.org' }) });
    if(!r1?.ok || !r1?.md) throw new Error('readweb_example_failed');
  }

  child.kill('SIGTERM');
  await once(child, 'exit');
  console.log('INTEGRATION: pass');
}

main().catch((e)=>{ console.error('INTEGRATION: fail', e); process.exit(1); });
