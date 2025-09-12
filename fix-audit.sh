#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "Error on line $LINENO"; exit 1' ERR

echo "▶ npm audit triage & prune"

# helper: does package exist in deps or devDeps?
has_pkg() {
  local pkg="$1"
  local out
  out="$(npm pkg get "dependencies.$pkg" "devDependencies.$pkg" 2>/dev/null | tr -d ' \n')"
  [[ "$out" != "nullnull" ]]
}

# 1) remove high-risk legacy deps if present
for pkg in jq download-git-repo bat-cli git-clone xmlhttprequest request; do
  if has_pkg "$pkg"; then
    echo "— removing direct dependency: $pkg"
    npm remove "$pkg" || true
  fi
done

# 2) optional: if your code used download-git-repo, recommend degit (don’t auto-install)
echo "ℹ If you used 'download-git-repo', prefer: npx degit user/repo target/"

# 3) clean tree & try audits’ automatic fixes
npm dedupe || true
npm audit fix || true

# 4) quick visibility: show whether the worst offenders remain anywhere in the tree
echo
echo "▶ residue check (transitives)"
for mod in request form-data tough-cookie xmlhttprequest git-clone download got tmp; do
  echo -n "$mod: "
  npm ls "$mod" --all --parseable 2>/dev/null | sed -n '2p' >/dev/null && echo "present" || echo "not found"
done

echo
echo "▶ final audit"
npm audit || true

echo "✅ done. review 'tmp' via inquirer/external-editor if you ship an interactive CLI."
