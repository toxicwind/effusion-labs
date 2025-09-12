# save as: hotfix-vite-alias.sh
# run: bash hotfix-vite-alias.sh && npm run dev
set -euo pipefail

APP_JS="src/assets/js/app.js"
VITE_CFG="vite.config.mjs"

# 1) Patch the JS entry to import via alias
if grep -q 'import\s\+["'\'']\(/assets/css/app.css\|../css/app.css\)["'\'']' "$APP_JS"; then
  sed -i \
    -e 's#import "/assets/css/app.css"#import "@/assets/css/app.css"#' \
    -e "s#import '../css/app.css'#import '@/assets/css/app.css'#" \
    "$APP_JS"
  echo "✓ Rewrote CSS import in $APP_JS → import \"@/assets/css/app.css\""
else
  echo "• No absolute/relative CSS import found in $APP_JS (already good?)"
fi

# 2) Ensure Vite has an '@' alias to ./src and is allowed to read outside .11ty-vite
node - <<'NODE'
const fs = require('fs');
const p = 'vite.config.mjs';
let s = fs.readFileSync(p,'utf8');

if (!/import\s+\{\s*fileURLToPath,\s*URL\s*\}\s+from\s+['"]node:url['"]/.test(s)) {
  s = s.replace(/^(import .*?;[\r\n]+)/, `$1import { fileURLToPath, URL } from 'node:url';\n`);
  if (!/fileURLToPath/.test(s)) s = `import { fileURLToPath, URL } from 'node:url';\n` + s;
}

if (!/resolve\s*:\s*\{[\s\S]*alias/.test(s)) {
  s = s.replace(/export default\s*\{/, `export default {\n  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },`);
}

if (!/server\s*:\s*\{[\s\S]*fs[\s\S]*allow/.test(s)) {
  s = s.replace(/export default\s*\{/, `export default {\n  server: { fs: { allow: [fileURLToPath(new URL('./', import.meta.url)), fileURLToPath(new URL('./src', import.meta.url))] } },`);
}

fs.writeFileSync(p, s);
console.log('✓ Patched', p);
NODE

echo
echo "— Diff preview —"
git --no-pager diff -- $APP_JS $VITE_CFG || true

echo
echo "Run dev:"
echo "  npm run dev"
