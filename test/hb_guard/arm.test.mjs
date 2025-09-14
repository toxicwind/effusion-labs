import {spawnSync} from 'node:child_process';
import {strict as assert} from 'node:assert';
const cmd = `source utils/scripts/setup/env-bootstrap.sh; source utils/scripts/setup/env-bootstrap.sh`;
const res = spawnSync('bash', ['-lc', cmd], {encoding: 'utf8'});
assert.equal(res.stdout, '');
assert.ok(res.stderr.includes('HB guard: armed'));
assert.ok(res.stderr.includes('already armed'));
