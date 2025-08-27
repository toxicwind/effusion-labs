import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.resolve(__dirname, '../tools/pty-runner.mjs');

const res = spawnSync(process.execPath, [runner, '--', 'node', '-e', "console.log('ok')"], {
  encoding: 'utf8',
});

assert.equal(res.status, 0);
assert.match(res.stdout, /ok/);
