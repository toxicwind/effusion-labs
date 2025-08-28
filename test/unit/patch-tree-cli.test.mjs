import test from 'node:test';
import cp from 'node:child_process';

await test('tree-cli: piping output does not EPIPE', () => {
  // Use pipefail so a failure in the first command breaks the pipeline.
  const cmd = `set -o pipefail; node node_modules/tree-cli/bin/tree -L 1 -I "node_modules|_site|.git" | head -n 1`;
  const res = cp.spawnSync('bash', ['-lc', cmd], { encoding: 'utf8' });

  if (res.status !== 0) {
    throw new Error(`tree-cli piped run failed (exit ${res.status})\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`);
  }
});

