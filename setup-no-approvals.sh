#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "Error on line $LINENO"; exit 1' ERR

OWNER="${OWNER:-toxicwind}"
REPO="${REPO:-effusion-labs}"

command -v gh >/dev/null 2>&1 || { echo "Install GitHub CLI: https://cli.github.com/"; exit 1; }
gh auth status -h github.com >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }

# Find default branch (fallback to main)
BRANCH="$(gh repo view "$OWNER/$REPO" --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || true)"
[[ -z "${BRANCH:-}" ]] && BRANCH="main"

echo "Repo: $OWNER/$REPO  Branch: $BRANCH"

# Remove PR review requirement (ok if already absent)
if gh api "repos/$OWNER/$REPO/branches/$BRANCH/protection/required_pull_request_reviews" >/dev/null 2>&1; then
  gh api -X DELETE "repos/$OWNER/$REPO/branches/$BRANCH/protection/required_pull_request_reviews" >/dev/null
  echo "✓ Removed 'required pull request reviews' on $BRANCH"
else
  echo "✓ No PR review requirement present on $BRANCH"
fi

# (Optional) turn off workflow's ability to approve reviews (harmless if left on)
gh api -X PUT "repos/$OWNER/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=false >/dev/null
echo "✓ Set workflow can_approve_pull_request_reviews=false"

echo "Done. Existing PRs with auto-merge enabled will merge without approvals once other rules (if any) are satisfied."
