#!/usr/bin/env node
// Copies curated patches from `appliedpatches/` → `patches/` so that
// patch-package applies them on postinstall automatically.

import { promises as fs } from 'fs';
import path from 'path';

async function main() {
  const cwd = process.cwd();
  const srcDir = path.join(cwd, 'appliedpatches');
  const destDir = path.join(cwd, 'patches');

  try {
    // If there is no appliedpatches directory, nothing to sync.
    await fs.access(srcDir).catch(() => Promise.reject(new Error('skip')));
  } catch (e) {
    if (e.message === 'skip') return; // quietly exit when no curated patches
    throw e;
  }

  await fs.mkdir(destDir, { recursive: true });

  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  const patches = entries.filter(e => e.isFile() && e.name.endsWith('.patch'));

  for (const p of patches) {
    const from = path.join(srcDir, p.name);
    const to = path.join(destDir, p.name);
    await fs.copyFile(from, to);
    // eslint-disable-next-line no-console
    console.log(`[sync-patches] copied ${p.name}`);
  }
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[sync-patches] failed:', err?.message || err);
  process.exit(1);
});

