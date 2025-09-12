#!/usr/bin/env bash
set -Eeuo pipefail
trap 'echo "Error on line $LINENO"; exit 1' ERR

# Repo coordinates
OWNER="${OWNER:-toxicwind}"
REPO="${REPO:-effusion-labs}"

# ----- sanity checks -----
command -v gh >/dev/null 2>&1 || { echo "Install GitHub CLI: https://cli.github.com/"; exit 1; }
gh auth status -h github.com >/dev/null 2>&1 || { echo "Run: gh auth login"; exit 1; }

echo "Repository: $OWNER/$REPO"

# Default branch
BRANCH="$(gh repo view "$OWNER/$REPO" --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || true)"
[[ -z "${BRANCH:-}" ]] && BRANCH="main"
echo "Default branch: $BRANCH"

# 1) Enable repo-level Auto-merge
gh api -X PATCH "repos/$OWNER/$REPO" -F allow_auto_merge=true >/dev/null
echo "✓ Enabled 'Allow auto-merge' at repo level"

# 2) Workflow token permissions (write + can approve PR reviews)
gh api -X PUT "repos/$OWNER/$REPO/actions/permissions/workflow" \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true >/dev/null
echo "✓ Set workflow token: write + approve reviews"

# 3) Ensure branch protection exists; if missing, CREATE it with minimal config
if gh api "repos/$OWNER/$REPO/branches/$BRANCH/protection" >/dev/null 2>&1; then
  echo "✓ Branch protection already exists on $BRANCH"
else
  echo "• Creating minimal branch protection on $BRANCH"
  cat > /tmp/protection.json <<'JSON'
{
  "required_status_checks": null,
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
  gh api -X PUT \
    -H "Accept: application/vnd.github+json" \
    "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
    --input /tmp/protection.json >/dev/null
  echo "✓ Branch protection created on $BRANCH"
fi

# 3b) (idempotent) Make sure '1 approving review' rule is set
gh api -X PATCH \
  -H "Accept: application/vnd.github+json" \
  "repos/$OWNER/$REPO/branches/$BRANCH/protection/required_pull_request_reviews" \
  -F required_approving_review_count=1 \
  -F dismiss_stale_reviews=true \
  -F require_code_owner_reviews=false >/dev/null
echo "✓ Required 1 approving review on $BRANCH"

# 4) Approve & enable auto-merge for all open Dependabot PRs (bulk)
PRS="$(gh pr list --repo "$OWNER/$REPO" \
       --search "author:app/dependabot is:open" \
       --json number -q '.[].number' || true)"

if [[ -z "$PRS" ]]; then
  echo "No open Dependabot PRs found."
else
  for PR in $PRS; do
    echo "→ Processing PR #$PR"
    gh pr review --repo "$OWNER/$REPO" --approve "$PR" \
      --body "Auto-approval for Dependabot" >/dev/null || true
    if gh pr merge --repo "$OWNER/$REPO" --auto --squash "$PR"; then
      echo "  ✓ Auto-merge enabled on #$PR"
    else
      echo "  ⚠︎ Could not enable auto-merge on #$PR (checks may be failing or rules block it)."
    fi
  done
fi

echo "All done."
