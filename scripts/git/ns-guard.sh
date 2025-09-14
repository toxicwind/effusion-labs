#!/usr/bin/env bash
set -Eeuo pipefail
# Fail if a flat ref equals a namespace that also has children (e.g., "work" and "work/*").
prefixes=(work feat fix merge chore release hotfix)
mapfile -t refs < <(git for-each-ref --format='%(refname:short)' refs/heads)
declare -A has_flat has_child
for r in "${refs[@]}"; do
  IFS=/ read -r head rest <<<"$r"
  if [[ -z "${rest:-}" ]]; then has_flat["$head"]=1; else has_child["$head"]=1; fi
done
bad=()
for p in "${prefixes[@]}"; do
  if [[ "${has_flat[$p]+x}" && "${has_child[$p]+x}" ]]; then bad+=("$p"); fi
done
if (( ${#bad[@]} )); then
  echo "✖ namespace collision: ${bad[*]} (e.g., 'work' blocks 'work/*')." >&2
  echo "→ Rename flat branches: git branch -m work work/_root  (and similar)." >&2
  exit 1
fi
exit 0

