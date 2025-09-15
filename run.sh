#!/usr/bin/env bash
# audit-gh-protection.sh — compact, pager-free audit of Actions & branch protection
# Usage: ./audit-gh-protection.sh [owner/repo] [branch]
set -Eeuo pipefail

R="${1:-${R:-toxicwind/effusion-labs}}"
B="${2:-${B:-main}}"

# Hard kill any paging
export PAGER=
export GH_PAGER=

need() { command -v "$1" >/dev/null || { echo "missing required tool: $1" >&2; exit 127; }; }
need gh
need jq

# gh_json ENDPOINT [extra gh api args...]
# - returns valid JSON to stdout
# - on error/404, prints fallback (2nd echo) and sets non-zero, but we still consume a JSON fallback
gh_json() {
  local endpoint="$1"; shift || true
  local out
  if ! out="$(gh api "$endpoint" "$@" 2>/dev/null)"; then
    printf ''
    return 1
  fi
  if ! jq -e . >/dev/null 2>&1 <<<"$out"; then
    printf ''
    return 2
  fi
  printf '%s' "$out"
}

# Fetch with sane fallbacks
ap="$(gh_json "repos/$R/actions/permissions" || echo '{}')"
aw="$(gh_json "repos/$R/actions/permissions/workflow" || echo '{}')"
prot="$(gh_json "repos/$R/branches/$B/protection" || echo '{}')"
pr="$(gh_json "repos/$R/branches/$B/protection/required_pull_request_reviews" || echo '{}')"
ctx="$(gh_json "repos/$R/branches/$B/protection/required_status_checks/contexts" || echo '[]')"

# Emit one compact JSON line
jq -c -n \
  --arg repo "$R" \
  --arg branch "$B" \
  --argjson ap   "$ap" \
  --argjson aw   "$aw" \
  --argjson prot "$prot" \
  --argjson pr   "$pr" \
  --argjson ctx  "$ctx" \
'{
  repo:$repo, branch:$branch,
  actions:{
    enabled:($ap.enabled // null),
    allowed_actions:($ap.allowed_actions // null),
    default_workflow_permissions:($aw.default_workflow_permissions // null),
    can_approve_pull_request_reviews:($aw.can_approve_pull_request_reviews // null)
  },
  protection:{
    enforce_admins:(($prot.enforce_admins.enabled)//($prot.enforce_admins)//false),
    required_status_checks:{
      strict:($prot.required_status_checks.strict // false),
      contexts:$ctx
    },
    required_pull_request_reviews:{
      require_code_owner_reviews:($pr.require_code_owner_reviews // false),
      required_approving_review_count:($pr.required_approving_review_count // 0),
      bypass_pull_request_allowances:($pr.bypass_pull_request_allowances // {users:[],teams:[],apps:[]})
    }
  }
}'
