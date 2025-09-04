import test from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import http from 'node:http';

function startGateway(extraEnv = {}) {
  return new Promise((resolve) => {
    const proc = spawn('node', ['gateway/index.js'], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: { ...process.env, PROFILE: 'dev', PORT_SSE: '0', PORT_HTTP: '0', ...extraEnv }
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

test('searxng disabled when no url', async () => {
  const { proc, httpPort } = await startGateway();
  const res = await fetch(`http://localhost:${httpPort}/.well-known/mcp-servers.json`);
  const manifest = await res.json();
  const searx = manifest.servers.find((s) => s.name === 'searxng');
  assert.equal(searx.health, 'disabled');
  proc.kill();
  await new Promise((r) => proc.on('exit', r));
});

test('curl advertises flaresolverr capability', async () => {
  const srv = http.createServer((_, res) => res.end('ok'));
  await new Promise((r) => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}`;
  const { proc, httpPort } = await startGateway({ FLARESOLVERR_URL: url });
  const res = await fetch(`http://localhost:${httpPort}/.well-known/mcp-servers.json`);
  const manifest = await res.json();
  const curl = manifest.servers.find((s) => s.name === 'curl');
  assert.equal(curl.capabilities.flareSolverr, true);
  proc.kill();
  await new Promise((r) => proc.on('exit', r));
  srv.close();
});
