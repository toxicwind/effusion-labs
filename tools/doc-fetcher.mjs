// tools/doc-fetcher.mjs
// Safe, opt-in doc fetcher. Does nothing unless DOC_FETCH=1.
import { writeFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const OUT_DIR = path.join('artifacts','cache','docs');
const OUT_FILE = path.join(OUT_DIR, 'daisyui-version.json');

async function main() {
  if (process.env.DOC_FETCH !== '1') {
    console.log('[doc-fetcher] DOC_FETCH not set; skipping network access.');
    return;
  }
  console.log('[doc-fetcher] Fetching external docs (opt-in)…');
  try {
    // Keep it extremely safe and lightweight: hit a known CDN JSON and cache it.
    const res = await fetch('https://registry.npmjs.org/daisyui/latest', { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify({ name: json.name, version: json.version, fetchedAt: new Date().toISOString() }, null, 2));
    console.log(`[doc-fetcher] Cached ${json.name}@${json.version} -> ${OUT_FILE}`);
  } catch (e) {
    console.warn('[doc-fetcher] Non-fatal error:', e?.message || e);
    // Never fail the build
    await delay(1);
  }
}

main();

