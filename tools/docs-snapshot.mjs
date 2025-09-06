// tools/docs-snapshot.mjs
// Always-attempt documentation snapshotter for Tailwind & daisyUI pages.
// - Non-fatal on errors; retains last snapshot if fetch fails.
// - Designed to run in CI and locally; no env gating.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const UA = 'EffusionLabs-DocsSnapshot/1.0 (+https://effusionlabs.dev)';
const ROOT = path.join('docs','vendor');
const TASKS = [
  // Tailwind
  { vendor: 'tailwind', name: 'configuration', url: 'https://tailwindcss.com/docs/configuration' },
  { vendor: 'tailwind', name: 'content-configuration', url: 'https://tailwindcss.com/docs/content-configuration' },
  { vendor: 'tailwind', name: 'plugins', url: 'https://tailwindcss.com/docs/plugins' },
  { vendor: 'tailwind', name: 'detecting-classes', url: 'https://tailwindcss.com/docs/detecting-classes-in-source-files' },
  { vendor: 'tailwind', name: 'functions-and-directives', url: 'https://tailwindcss.com/docs/functions-and-directives' },
  { vendor: 'tailwind', name: 'upgrade-guide', url: 'https://tailwindcss.com/docs/upgrade-guide' },
  { vendor: 'tailwind', name: 'v4-blog', url: 'https://tailwindcss.com/blog/tailwindcss-v4' },
  // daisyUI
  { vendor: 'daisyui', name: 'themes', url: 'https://daisyui.com/docs/themes/' },
  { vendor: 'daisyui', name: 'colors', url: 'https://daisyui.com/docs/colors/' },
  { vendor: 'daisyui', name: 'configuration', url: 'https://daisyui.com/docs/config/' },
  { vendor: 'daisyui', name: 'components', url: 'https://daisyui.com/components/' },
  { vendor: 'daisyui', name: 'install', url: 'https://daisyui.com/docs/install/' },
  { vendor: 'daisyui', name: 'base', url: 'https://daisyui.com/docs/base/' },
  { vendor: 'daisyui', name: 'v5', url: 'https://daisyui.com/docs/v5/' },
  { vendor: 'daisyui', name: 'upgrade', url: 'https://daisyui.com/docs/upgrade/' },
];

async function fetchWithRetry(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function snapshotDocs() {
  for (const t of TASKS) {
    const dir = path.join(ROOT, t.vendor);
    const out = path.join(dir, `${t.name}.html`);
    try {
      await mkdir(dir, { recursive: true });
      const html = await fetchWithRetry(t.url, 3);
      await writeFile(out, html, 'utf8');
      console.log(`[docs-snapshot] Saved ${t.vendor}/${t.name}.html`);
    } catch (e) {
      console.warn(`[docs-snapshot] Warning: ${t.vendor}/${t.name} failed:`, e?.message || e);
      // Keep previous snapshot if exists; never fail build
    }
  }
}

// Allow `node tools/docs-snapshot.mjs` CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  snapshotDocs();
}

