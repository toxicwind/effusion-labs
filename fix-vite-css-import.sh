#!/usr/bin/env bash
set -euo pipefail

APP_JS="src/assets/js/app.js"
VITE_CFG="vite.config.mjs"

echo "→ Ensuring CSS import in $APP_JS uses alias '@/assets/css/app.css'"
if [ -f "$APP_JS" ]; then
  # rewrite any absolute or relative variants to the alias
  sed -i \
    -e 's#import[[:space:]]\+["'\'']\(/assets/css/app.css\|../css/app.css\)["'\'']#import "@/assets/css/app.css"#' \
    "$APP_JS"
else
  echo "!! Missing $APP_JS — adjust the path in this script if your entry file differs"
  exit 1
fi

echo "→ Patching $VITE_CFG with '@' alias → ./src and server fs allow"
# Node one-liner to idempotently patch vite.config.mjs
node - <<'NODE'
import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const p = 'vite.config.mjs';
if (!fs.existsSync(p)) {
  console.error(`!! ${p} not found`);
  process.exit(1);
}
let s = fs.readFileSync(p, 'utf8');

// Ensure import for fileURLToPath/URL exists
if (!/from\s+['"]node:url['"]/.test(s)) {
  s = `import { fileURLToPath, URL } from 'node:url';\n` + s;
}

// ensure `export default { ... }` exists
if (!/export\s+default\s*\{/.test(s)) {
  console.error('!! Could not find `export default {` in vite.config.mjs');
  process.exit(1);
}

// Add resolve.alias for '@' → ./src (idempotent)
if (!/resolve\s*:\s*\{[\s\S]*alias/.test(s)) {
  s = s.replace(/export\s+default\s*\{/, `export default {\n  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },`);
} else if (!/alias[\s\S]*['"]@['"]/.test(s)) {
  s = s.replace(/resolve\s*:\s*\{([^}]*)\}/, (_m, inner) =>
    `resolve: { ${inner.trim().replace(/,$/, '')}, alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }`
  );
}

// Allow Vite dev server to read project+src paths (helps Eleventy temp dirs)
if (!/server\s*:\s*\{[\s\S]*fs[\s\S]*allow/.test(s)) {
  s = s.replace(/export\s+default\s*\{/, `export default {\n  server: { fs: { allow: [fileURLToPath(new URL('./', import.meta.url)), fileURLToPath(new URL('./src', import.meta.url))] } },`);
}

fs.writeFileSync(p, s);
console.log('✓ Patched vite.config.mjs');
NODE

echo "→ Verifying source CSS exists"
test -f "src/assets/css/app.css" || { echo "!! src/assets/css/app.css not found"; exit 1; }

echo "✓ Done. Start dev with: npm run dev"
