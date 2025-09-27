#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, delimiter as PATH_DELIM } from 'node:path';
import { writeFile } from 'node:fs/promises';
import process from 'node:process';

const __filename = fileURLToPath(import.meta.url);
const BIN_DIR = dirname(__filename);
const REPO_ROOT = dirname(BIN_DIR);
const NODE_BIN = join(REPO_ROOT, 'node_modules', '.bin');
process.env.PATH = process.env.PATH ? `${NODE_BIN}${PATH_DELIM}${process.env.PATH}` : NODE_BIN;

const rawArgs = process.argv.slice(2);
let mode = null;
let soft = null;
let knipReport = false;
const KNIP_REPORT_TARGETS = [
  { reporter: 'json', file: '.knip-report.json', format: 'json' },
  { reporter: 'markdown', file: '.knip-report.md', format: 'text' },
  { reporter: 'codeclimate', file: '.knip-report.codeclimate.json', format: 'json' }
];

for (const arg of rawArgs) {
  if (arg === 'apply' || arg === '--apply') {
    mode = 'apply';
  } else if (arg === 'check' || arg === '--check') {
    mode = 'check';
  } else if (arg === '--soft') {
    soft = true;
  } else if (arg === '--hard') {
    soft = false;
  } else if (arg === '--knip-report' || arg === '--report-knip') {
    knipReport = true;
  }
}

if (mode === null) mode = 'apply';
if (soft === null) soft = false;

const TASKS = [
  {
    id: 'eslint',
    label: 'ESLint',
    commands: {
      apply: ['eslint', '--fix', '--cache', '--cache-location', '.cache/eslint', 'src/**/*.{js,mjs,ts,tsx}', 'tools/**/*.mjs', 'mcp-stack/**/*.mjs', 'eleventy.config.mjs'],
      check: ['eslint', '--max-warnings=0', '--cache', '--cache-location', '.cache/eslint', 'src/**/*.{js,mjs,ts,tsx}', 'tools/**/*.mjs', 'mcp-stack/**/*.mjs', 'eleventy.config.mjs']
    }
  },
  {
    id: 'rustywind',
    label: 'RustyWind',
    commands: {
      apply: ['rustywind', '--write', 'src/**/*.{njk,html,js,jsx,ts,tsx}'],
      check: ['rustywind', '--check-formatted', 'src/**/*.{njk,html,js,jsx,ts,tsx}']
    }
  },
  {
    id: 'knip',
    label: 'Knip',
    commands: {
      apply: ['knip', '--production', '--reporter', 'symbols', '--fix', '--format', '--fix-type', 'dependencies', '--fix-type', 'exports'],
      check: ['knip', '--production', '--reporter', 'symbols']
    }
  },
  {
    id: 'dprint',
    label: 'dprint',
    commands: {
      apply: ['dprint', 'fmt', '-c', 'dprint.json'],
      check: ['dprint', 'check', '-c', 'dprint.json']
    }
  }
];

function runCommand(command, args, { capture = false } = {}) {
  return new Promise(resolve => {
    const stdio = capture ? ['inherit', 'pipe', 'inherit'] : 'inherit';
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      shell: false,
      stdio,
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    let stdout = '';
    if (capture && child.stdout) {
      child.stdout.on('data', chunk => {
        stdout += chunk.toString();
      });
    }

    child.on('close', code => {
      resolve({ code: code ?? 0, stdout });
    });
  });
}

function formatKnipJson(raw) {
  if (!raw) return '';
  const start = raw.indexOf('{');
  if (start === -1) return '';
  const trimmed = raw.slice(start).trim();
  const end = trimmed.lastIndexOf('}');
  if (end === -1) return '';
  const jsonSlice = trimmed.slice(0, end + 1);
  try {
    const parsed = JSON.parse(jsonSlice);
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch (error) {
    console.warn('⚠ Knip JSON parse failed, persisting raw payload.');
    return `${jsonSlice}\n`;
  }
}

function stripKnipBanner(raw) {
  if (!raw) return '';
  return raw
    .split(/\r?\n/)
    .filter(line => !line.startsWith('🗂'))
    .join('\n')
    .trim();
}

async function writeKnipReports() {
  for (const target of KNIP_REPORT_TARGETS) {
    const args = [
      'knip',
      '--production',
      '--reporter',
      target.reporter,
      '--no-exit-code'
    ];
    const { stdout } = await runCommand(args[0], args.slice(1), { capture: true });
    let payload = stripKnipBanner(stdout);
    if (target.format === 'json') {
      payload = formatKnipJson(payload) || '[]\n';
    } else if (payload) {
      payload = `${payload}\n`;
    }

    const savePath = join(REPO_ROOT, target.file);
    await writeFile(savePath, payload, 'utf8');
    console.log(`📄 Saved Knip ${target.reporter} report → ${savePath}`);
  }
}

(async () => {
  console.log(`Quality pipeline → mode: ${mode}, soft: ${soft ? 'yes' : 'no'}`);
  const failures = [];

  for (const task of TASKS) {
    const spec = task.commands[mode];
    if (!spec) continue;
    console.log(`\n▶ ${task.label}`);
    const [command, ...args] = spec;
    const { code } = await runCommand(command, args);
    if (code !== 0) {
      failures.push({ task: task.label, code });
      console.error(`⚠ ${task.label} exited with code ${code}`);
    }

    if (task.id === 'knip' && knipReport) {
      await writeKnipReports();
    }
  }

  if (failures.length) {
    console.log('\nQuality summary');
    for (const entry of failures) {
      console.log(` - ${entry.task} (exit ${entry.code})`);
    }
  }

  if (failures.length && !soft) {
    process.exit(1);
  }

  process.exit(0);
})();
