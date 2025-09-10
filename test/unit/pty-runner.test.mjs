import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// pty-runner lives in the project-level tools directory
const runner = path.resolve(__dirname, '../../test/unit/pty-runner.test.mjs');

const res = spawnSync(process.execPath, [runner, '--', 'node', '-e', "console.log('ok')"], {
  encoding: 'utf8',
});

assert.equal(res.status, 0);
assert.match(res.stdout, /ok/);
