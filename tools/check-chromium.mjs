#!/usr/bin/env node
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import process from 'node:process';

const candidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROMIUM_BIN,
  process.env.CHROME_BIN,
  'chromium',
  'chromium-browser',
  'google-chrome-stable',
  'google-chrome',
];

function which(command) {
  return new Promise((resolve) => {
    if (!command) {
      resolve('');
      return;
    }
    const bin = spawn('which', [command], { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    bin.stdout.on('data', (data) => {
      output += data.toString();
    });
    bin.on('close', (code) => {
      resolve(code === 0 ? output.trim() : '');
    });
    bin.on('error', () => resolve(''));
  });
}

async function canExecute(path) {
  if (!path) return false;
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveChromium() {
  for (const candidate of candidates) {
    const location = candidate?.includes('/') ? candidate : await which(candidate);
    if (await canExecute(location)) {
      return location;
    }
  }
  return '';
}

const chromiumPath = await resolveChromium();

if (!chromiumPath) {
  console.error('❌ Chromium binary not found. Set PUPPETEER_EXECUTABLE_PATH to a valid binary.');
  process.exit(1);
}

if (process.env.CI) {
  console.log(`Chromium available at ${chromiumPath}`);
}

if (process.env.GITHUB_ENV && process.env.CI && !process.env.PUPPETEER_EXECUTABLE_PATH) {
  console.log('PUPPETEER_EXECUTABLE_PATH not exported; writing to $GITHUB_ENV.');
  const fs = await import('node:fs/promises');
  await fs.appendFile(process.env.GITHUB_ENV, `PUPPETEER_EXECUTABLE_PATH=${chromiumPath}\n`, 'utf8');
}
