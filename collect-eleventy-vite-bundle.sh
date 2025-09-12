#!/usr/bin/env bash
set -Eeuo pipefail

OUT="${1:-lib_content.json}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing $1"; exit 1; }; }
need jq
need find
need grep

add_file() { [ -f "$1" ] && printf '%s\0' "$1" >> "$TMP"; }
add_dir_exts() {
  local dir="$1"; shift
  [ -d "$dir" ] || return 0
  # build a find predicate like -name "*.css" -o -name "*.scss" ...
  local pred=()
  for ext in "$@"; do pred+=( -name "*.$ext" -o ); done
  # trim trailing -o
  [ ${#pred[@]} -gt 0 ] && unset 'pred[${#pred[@]}]'
  # shellcheck disable=SC2068
  find "$dir" \( ${pred[@]} \) -type f -print0 >> "$TMP"
}

# --- Config files
for f in \
  package.json \
  vite.config.mjs vite.config.js vite.config.ts \
  tailwind.config.mjs tailwind.config.js tailwind.config.cjs tailwind.config.ts \
  eleventy.config.mjs eleventy.config.js eleventy.config.cjs \
  .eleventy.mjs .eleventy.js .eleventy.cjs \
  .eleventyignore
do add_file "$f"; done

# Eleventy helpers
[ -d utils/dev   ] && find utils/dev   -type f -name '*.mjs' -print0 >> "$TMP"
[ -d utils/build ] && find utils/build -type f -name '*.mjs' -print0 >> "$TMP"

# --- Templates (likely to contain <link> or <script> tags)
for dir in _includes src src/pages; do
  [ -d "$dir" ] || continue
  find "$dir" \
    \( -name '*.njk' -o -name '*.liquid' -o -name '*.html' -o \
       -name '*.11ty.js' -o -name '*.11ty.mjs' -o -name '*.11ty.cjs' \) \
    -type f -print0 >> "$TMP"
done

# --- Front-end sources (CSS/JS entries)
add_dir_exts src/styles   css scss sass pcss
add_dir_exts src/assets/css css scss sass pcss
add_dir_exts src/assets/js  js mjs cjs ts tsx jsx
add_dir_exts assets/css     css scss sass pcss
add_dir_exts assets/js      js mjs cjs ts tsx jsx
# common Vite entries at repo root or under src/
for f in src/main.ts src/main.js main.ts main.js; do add_file "$f"; done

# --- Any file that references the legacy path /assets/css/app.css
# (This pinpoints the offending template that Vite is trying to resolve.)
grep -RIl --exclude-dir=node_modules '/assets/css/app\.css' . 2>/dev/null | while read -r f; do
  add_file "$f"
done

# --- Emit JSON array
{
  echo '['
  first=1
  while IFS= read -r -d '' f; do
    obj=$(jq -n --arg path "$f" --rawfile content "$f" '{path:$path, content:$content}')
    if [ "$first" -eq 1 ]; then
      printf '%s' "$obj"; first=0
    else
      printf ',%s' "$obj"
    fi
  done < "$TMP"
  echo ']'
} > "$OUT"

echo "Wrote $OUT"
