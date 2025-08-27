import cp from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const strategies = [
  {
    name: 'llm_run',
    spawn: (cmd, args, opts) =>
      cp.spawn('llm_run', ['--', cmd, ...args], { ...opts, stdio: 'inherit' }),
  },
  {
    name: 'npm_exec',
    // use npm exec to launch the command without extra argument separators
    spawn: (cmd, args, opts) =>
      cp.spawn(path.resolve('./bin/npm'), ['exec', cmd, ...args], {
        ...opts,
        stdio: 'inherit',
      }),
  },
  {
    name: 'direct',
    spawn: (cmd, args, opts) => cp.spawn(cmd, args, { ...opts, stdio: 'inherit' }),
  },
];

export async function run(cmd, args = [], opts = {}) {
  for (const strat of strategies) {
    console.log(`// trying ${strat.name}`);
    try {
      const code = await new Promise((resolve) => {
        const child = strat.spawn(cmd, args, opts);
        child.on('close', (c) => resolve(c));
        child.on('error', () => resolve(null));
      });
      if (code === 0) {
        console.log(`// ${strat.name} succeeded`);
        return 0;
      }
      console.warn(`// ${strat.name} failed with code ${code}`);
    } catch (err) {
      console.warn(`// ${strat.name} error: ${err.message}`);
    }
  }
  console.error('// all strategies failed');
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd) {
    console.error('usage: node tools/pty-runner.mjs <cmd> [args...]');
    process.exit(1);
  }
  run(cmd, rest).then((code) => process.exit(code));
}
