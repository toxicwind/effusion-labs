#!/bin/bash
# Quick script to generate Portainer API key and fetch webhook

USERNAME="${PORTAINER_USER:-admin}"
PASSWORD="${PORTAINER_PASS:-}"
PORTAINER_URL="http://mildlyawesome.com:9000"

if [ -z "$PASSWORD" ]; then
  echo "Enter Portainer password for user '$USERNAME':"
  read -s PASSWORD
fi

echo "Authenticating..."
TOKEN=$(curl -s -X POST "${PORTAINER_URL}/api/auth" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}" \
  | jq -r .jwt)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed"
  exit 1
fi

echo "✅ Authenticated"

# List stacks
echo ""
echo "Fetching stacks..."
STACKS=$(curl -s "${PORTAINER_URL}/api/stacks" \
  -H "Authorization: Bearer $TOKEN")

echo "$STACKS" | jq -r '.[] | "\(.Id) - \(.Name)"'

echo ""
echo "Enter Stack ID for effusion-labs:"
read STACK_ID

# Get stack details including webhook
STACK_INFO=$(curl -s "${PORTAINER_URL}/api/stacks/${STACK_ID}" \
  -H "Authorization: Bearer $TOKEN")

WEBHOOK=$(echo "$STACK_INFO" | jq -r '.AutoUpdate.Webhook // empty')

if [ -n "$WEBHOOK" ]; then
  echo ""
  echo "✅ Found webhook!"
  echo "PORTAINER_WEBHOOK=${PORTAINER_URL}${WEBHOOK}"
else
  echo "⚠️  No webhook configured. You can create one in Portainer UI."
fi

echo ""
echo "To use portainer-client.sh, generate an API key:"
echo "1. Login to Portainer → My Account → Access tokens"
echo "2. Add new token, copy it"
echo "3. Set PORTAINER_API_KEY in .env"
