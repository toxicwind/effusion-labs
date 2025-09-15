#!/usr/bin/env bash
set -Eeuo pipefail

OUT="${1:-lib_content.json}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Build a null-delimited list of files without spawning login shells.
add_file() { [ -f "$1" ] && printf '%s\0' "$1" >> "$TMP"; }


# Config files (include whichever exist)
add_file package.json
for f in vite.config.mjs vite.config.js vite.config.ts \
         tailwind.config.mjs tailwind.config.js tailwind.config.cjs tailwind.config.ts
do add_file "$f"; done

# Emit JSON array: [{path, content}, ...]
# No subshells, no login shells; just a null-delimited read loop.
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
