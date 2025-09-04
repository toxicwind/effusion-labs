import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import EventSource from 'eventsource';

function startGateway() {
  return new Promise((resolve) => {
    const proc = spawn('node', ['gateway/index.js'], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: { ...process.env, PROFILE: 'dev', PORT_SSE: '0', PORT_HTTP: '0' }
    });
    let ssePort, httpPort;
    proc.stdout.on('data', (d) => {
      const line = d.toString();
      const m1 = line.match(/SSE listening on (\d+)/);
      const m2 = line.match(/HTTP listening on (\d+)/);
      if (m1) ssePort = Number(m1[1]);
      if (m2) httpPort = Number(m2[1]);
      if (ssePort && httpPort) resolve({ proc, ssePort, httpPort });
    });
  });
}

test('gateway smoke', async () => {
  const { proc, ssePort, httpPort } = await startGateway();
  const res = await fetch(`http://localhost:${httpPort}/servers`);
  const list = await res.json();
  assert.ok(list.includes('filesystem'));
  await new Promise((resolve) => {
    const es = new EventSource(`http://localhost:${ssePort}/servers/filesystem/sse`);
    es.onmessage = (e) => {
      if (e.data === 'connected') {
        es.close();
        resolve();
      }
    };
  });
  proc.kill();
  await new Promise((r) => proc.on('exit', r));
});
