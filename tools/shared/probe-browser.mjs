import fs from 'node:fs';

export async function canRunBrowser() {
  try {
    const { chromium } = await import('playwright-core');
    const exe = chromium.executablePath();
    return typeof exe === 'string' && fs.existsSync(exe);
  } catch {
    return false;
  }
}

