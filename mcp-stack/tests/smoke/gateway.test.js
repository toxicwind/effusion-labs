import { spawn } from 'child_process';
import { once } from 'events';
import { test } from 'node:test';
import { strict as assert } from 'assert';

function startGateway() {
  const child = spawn('node', ['mcp-stack/gateway/index.js'], {
    env: { ...process.env, PORT_HTTP: '0' },
    stdio: ['ignore', 'pipe', 'inherit']
  });
  return child;
}

test('discovery lists servers', async () => {
  const child = startGateway();
  const [line] = await once(child.stdout, 'data');
  const log = JSON.parse(line.toString());
  const port = log.port;
  const res = await fetch(`http://localhost:${port}/.well-known/mcp-servers.json`);
  assert.equal(res.status, 200);
  const servers = await res.json();
  assert.ok(Array.isArray(servers));
  assert.ok(servers.find(s => s.name === 'filesystem'));
  child.kill();
});
