#!/bin/bash
set -euo pipefail

# CHRONOS FORGE :: Portainer API Client
# Validates connectivity and triggers stack updates via API Key

LOG_TAG="[portainer-cli]"

# Configuration
PORTAINER_URL="${PORTAINER_URL:-}"
PORTAINER_API_KEY="${PORTAINER_API_KEY:-}"
STACK_ID="${PORTAINER_STACK_ID:-}"
ENDPOINT_ID="${PORTAINER_ENDPOINT_ID:-1}" # Default to local endpoint usually 1

log() {
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") ${LOG_TAG} $1"
}

usage() {
    echo "Usage: $0 [command]"
    echo "Commands:"
    echo "  check      - Verify API connectivity"
    echo "  list       - List all stacks"
    echo "  inspect    - Inspect configured stack"
    echo "  update     - Pull and update the stack (git/repo)"
    echo ""
    echo "Environment Variables Required:"
    echo "  PORTAINER_URL      (e.g., https://portainer.example.com)"
    echo "  PORTAINER_API_KEY  (AccessToken from My Account)"
}

if [ -z "$PORTAINER_URL" ] || [ -z "$PORTAINER_API_KEY" ]; then
    log "ERROR: Missing configuration."
    usage
    exit 1
fi

# Helper for GET requests
api_get() {
    local path="$1"
    curl -fsSL -H "X-API-Key: $PORTAINER_API_KEY" \
        -H "Content-Type: application/json" \
        "${PORTAINER_URL}/api${path}"
}

# Helper for POST requests
api_post() {
    local path="$1"
    local data="$2"
    curl -fsSL -X POST -H "X-API-Key: $PORTAINER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$data" \
        "${PORTAINER_URL}/api${path}"
}

cmd_check() {
    log "Checking connectivity to ${PORTAINER_URL}..."
    status=$(api_get "/status" | jq -r .Status 2>/dev/null || echo "failed")
    if [ "$status" != "failed" ]; then
        log "✅ Connection successful. Portainer Status: $status"
    else
        log "❌ Connection failed. Check URL and API Key."
        exit 1
    fi
}

cmd_list() {
    log "Fetching stacks..."
    api_get "/stacks" | jq -r '.[] | "\(.Id) \(.Name) (\(.Status))"'
}

cmd_inspect() {
    if [ -z "$STACK_ID" ]; then
        log "ERROR: PORTAINER_STACK_ID required for inspect."
        exit 1
    fi
    log "Inspecting Stack ID: $STACK_ID"
    api_get "/stacks/${STACK_ID}" | jq .
}

cmd_update() {
    if [ -z "$STACK_ID" ]; then
        log "ERROR: PORTAINER_STACK_ID required for update."
        exit 1
    fi
    
    log "Triggering update for Stack ID: $STACK_ID..."
    
    # Get current stack info to find the git config
    stack_info=$(api_get "/stacks/${STACK_ID}")
    repo_url=$(echo "$stack_info" | jq -r .GitConfig.URL)
    repo_ref=$(echo "$stack_info" | jq -r .GitConfig.ReferenceName)
    
    log "Repository: $repo_url ($repo_ref)"
    
    # Payload for pulling from git
    # Note: This verifies the stack is git-linked
    payload=$(jq -n \
        --arg ref "$repo_ref" \
        '{
            pullImage: true,
            prune: true,
            repositoryReferenceName: $ref,
            forceBuild: false
        }')

    response=$(curl -s -X PUT -H "X-API-Key: $PORTAINER_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${PORTAINER_URL}/api/stacks/${STACK_ID}/git/redeploy?endpointId=${ENDPOINT_ID}")
        
    log "Update triggered manually."
    echo "$response" | jq .
}

case "${1:-}" in
    check) cmd_check ;;
    list) cmd_list ;;
    inspect) cmd_inspect ;;
    update) cmd_update ;;
    *) usage ;;
esac
