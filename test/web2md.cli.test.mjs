import { createServer } from 'node:http';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);

test('web2md CLI prints markdown and sha256 hash', async () => {
  const html = '<!doctype html><html><body><h1>Hello</h1></body></html>';
  const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();

  const { stdout } = await execFileAsync('node', ['webpage-to-markdown.js', `http://localhost:${port}/`]);
  server.close();
  await once(server, 'close');

  const lines = stdout.trim().split('\n');
  const hashLine = lines.pop();
  const md = lines.join('\n');
  const expected = createHash('sha256').update(md).digest('hex');
  assert.equal(hashLine, `sha256:${expected}`);
  assert.match(md, /Hello/);
});
