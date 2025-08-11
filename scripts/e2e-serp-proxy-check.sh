#!/usr/bin/env bash
set -euo pipefail

# Proxy preflight
DOMAIN="mildlyawesome.com"
PORT=49159

echo "[Preflight] DNS lookup"
getent hosts "$DOMAIN" || { echo "DNS lookup failed"; exit 1; }

echo "[Preflight] TCP connectivity"
if ! nc -vz "$DOMAIN" "$PORT"; then
  echo "TCP connection failed"; exit 1; fi

echo "[Preflight] Unauthenticated HTTP via proxy"
code=$(curl -sS -o /dev/null -w '%{http_code}\n' -x "http://$DOMAIN:$PORT" http://example.com --connect-timeout 8 || true)
echo "HTTP status: $code"
if [ "$code" != "407" ]; then echo "Expected 407"; exit 1; fi

echo "[Preflight] Authenticated CONNECT"
code=$(curl -sS -o /dev/null -w '%{http_code}\n' --connect-timeout 12 -x "http://$DOMAIN:$PORT" -U "$OUTBOUND_PROXY_USER:$OUTBOUND_PROXY_PASS" https://httpbin.org/ip || true)
echo "HTTP status: $code"
if [ "$code" != "200" ] && [ "$code" != "301" ] && [ "$code" != "302" ]; then
  echo "Authenticated CONNECT failed"; exit 1; fi

QUERY="pop mart monsters time to chill site:popmart.com"
MAX_RETRIES=3
BACKOFF=2
RESULT_LINK=""

for ((i=1;i<=MAX_RETRIES;i++)); do
  echo "[search2serp] Attempt $i"
  out=$(node tools/search2serp/cli.js "$QUERY" 2>/tmp/search2serp.err || true)
  if echo "$out" | grep -qi 'popmart.com'; then
    RESULT_LINK=$(echo "$out" | node -e "const data=JSON.parse(fs.readFileSync(0,'utf8'));const r=data.results.find(r=>/popmart.com/.test(r.url));if(r)console.log(r.url);")
    [ -n "$RESULT_LINK" ] && break
  fi
  sleep $((BACKOFF*i))
done

if [ -z "$RESULT_LINK" ]; then
  echo "search2serp failed"; exit 1; fi

echo "[web2md] Fetching $RESULT_LINK"
for ((i=1;i<=MAX_RETRIES;i++)); do
  page=$(node webpage-to-markdown.js "$RESULT_LINK" 2>/tmp/web2md.err || true)
  if echo "$page" | grep -q "October 31, 2022"; then
    echo "$page" > /tmp/web2md.out
    echo "Success"; exit 0
  fi
  sleep $((BACKOFF*i))
done

echo "web2md failed"; exit 1
