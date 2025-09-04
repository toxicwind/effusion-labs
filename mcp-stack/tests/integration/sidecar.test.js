import { spawn } from 'child_process';
import { once } from 'events';
import { test } from 'node:test';
import { strict as assert } from 'assert';

test('searxng disabled when no env', async () => {
  const child = spawn('node', ['mcp-stack/gateway/index.js'], {
    env: { ...process.env, PORT_HTTP: '0', SEARXNG_ENGINE_URL: '' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const [line] = await once(child.stdout, 'data');
  const log = JSON.parse(line.toString());
  const port = log.port;
  const res = await fetch(`http://localhost:${port}/.well-known/mcp-servers.json`);
  const servers = await res.json();
  const srv = servers.find(s => s.name === 'searxng');
  assert.equal(srv.health, 'disabled');
  child.kill();
});
