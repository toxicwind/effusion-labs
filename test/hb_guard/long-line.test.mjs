import {spawnSync} from 'node:child_process';
import {strict as assert} from 'node:assert';
function run(len){
  const payload = 'A'.repeat(len);
  const cmd = `source utils/scripts/setup/env-bootstrap.sh >/dev/null; python3 - <<PY\nprint("${payload}")\nPY`;
  return spawnSync('bash',['-lc', cmd],{encoding:'utf8'});
}
[3499,3500,3501].forEach(len=>{
  const r=run(len);
  assert.equal(r.status,0);
  if(len<=3500){
    assert.ok(!r.stdout.includes('HBWRAP'),`unexpected wrap for len ${len}`);
  } else {
    assert.ok(r.stdout.includes('[HBWRAP 1/2 1..3500]'));
    assert.ok(r.stdout.includes('[HBWRAP 2/2 3501..3501]'));
  }
});
