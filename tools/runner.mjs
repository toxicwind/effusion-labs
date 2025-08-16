import { spawn } from 'node:child_process';
import process from 'node:process';
import probe from './probe.mjs';
import select from './select.mjs';

async function main() {
  const all = process.argv.includes('--all');
  const tests = await select({ all });
  const caps = await probe();

  const execute = [];
  const parked = [];
  for (const t of tests) {
    if (t.caps.browser && !caps.browser) {
      parked.push({ file: t.file, reason: 'browser capability absent' });
    } else {
      execute.push(t.file);
    }
  }

  if (!execute.length) {
    console.log('No tests to run');
    if (parked.length) {
      console.log(`Parked ${parked.length} tests:`);
      parked.slice(0, 200).forEach(p => console.log(`${p.file}\t${p.reason}`));
    }
    return;
  }

  const child = spawn(process.execPath, ['--test', '--test-reporter=spec', ...execute], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--import=./test/setup/http.mjs' },
  });

  child.on('exit', code => {
    console.log(`Executed ${execute.length} tests`);
    if (parked.length) {
      console.log(`Parked ${parked.length} tests:`);
      parked.slice(0, 200).forEach(p => console.log(`${p.file}\t${p.reason}`));
    }
    process.exit(code);
  });
}

main();
