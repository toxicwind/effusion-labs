#!/usr/bin/env bash
set -euo pipefail

# Proxy preflight
getent hosts mildlyawesome.com || nslookup mildlyawesome.com
nc -vz mildlyawesome.com 49159
code=$(curl -sS -o /dev/null -w '%{http_code}\n' -x http://mildlyawesome.com:49159 http://example.com --connect-timeout 8)
[[ "$code" == "407" ]] || { echo "Expected 407, got $code"; exit 1; }
code=$(curl -sS -o /dev/null -w '%{http_code}\n' --connect-timeout 12 -x http://mildlyawesome.com:49159 -U "toxic:Ann3xx!597e5Bmx" https://httpbin.org/ip)
[[ "$code" =~ ^(200|301|302)$ ]] || { echo "Authenticated CONNECT failed: $code"; exit 1; }

query="pop mart monsters time to chill site:popmart.com"
link=""
for attempt in 1 2 3; do
  json=$(node tools/search2serp/cli.js "$query" || true)
  link=$(echo "$json" | jq -r '.results[].link | select(test("popmart.com/.*/labubu.*time.*to.*chill"; "i"))' | head -n1)
  [[ -n "$link" ]] && break
  sleep $attempt
 done
[[ -n "$link" ]] || { echo "Expected Pop Mart link not found"; exit 1; }

content=""
for attempt in 1 2 3; do
  content=$(node webpage-to-markdown.js "$link" || true)
  echo "$content" | grep -q 'October 31, 2022' && break
  sleep $attempt
 done
echo "$content" | grep -q 'October 31, 2022' || { echo "Date string not found"; exit 1; }

exit 0
