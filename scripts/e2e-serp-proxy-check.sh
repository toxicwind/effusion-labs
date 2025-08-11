#!/usr/bin/env bash
set -euo pipefail

QUERY="pop mart monsters time to chill site:popmart.com"
TMP_DIR="tmp"
SERP_JSON="$TMP_DIR/serp.json"
PAGE_MD="$TMP_DIR/page.md"

# Section 1-3: preflight & dual-hop proofs
curl -fsS https://www.gstatic.com/generate_204 -o /dev/null && echo "[baseline] OK"
getent hosts mildlyawesome.com || nslookup mildlyawesome.com || dig +short mildlyawesome.com
curl -fsS --preproxy http://proxy:8080 https://httpbin.org/ip -o /dev/null
curl -sS -o /dev/null -w '%{http_code}\n' \
  --preproxy http://proxy:8080 \
  -x http://mildlyawesome.com:49159 \
  http://example.com --connect-timeout 8
curl -sS -o /dev/null -w '%{http_code}\n' \
  --preproxy http://proxy:8080 \
  -x http://mildlyawesome.com:49159 \
  -U 'toxic:Ann3xx!597e5Bmx' \
  https://httpbin.org/ip --connect-timeout 12

# Section 4: launch chain shim
PRE_HOP_PROXY="http://proxy:8080" \
OUTBOUND_PROXY_URL="http://mildlyawesome.com:49159" \
OUTBOUND_PROXY_USER="toxic" \
OUTBOUND_PROXY_PASS='Ann3xx!597e5Bmx' \
node tools/shared/chain-proxy.mjs &
CHAIN_PID=$!
sleep 2
export CHAIN_PROXY_URL="http://127.0.0.1:8899"
curl -v -x "$CHAIN_PROXY_URL" https://httpbin.org/ip

# Section 5: search2serp
mkdir -p "$TMP_DIR"
node tools/search2serp/cli.js "$QUERY" > "$SERP_JSON"
LINK=$(node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync('$SERP_JSON','utf8'));const m=d.results.find(r=>r.url==='https://www.popmart.com/us/products/578/labubu-time-to-chill-vinyl-plush-doll'||r.url==='https://www.popmart.com/products/578/labubu-time-to-chill-vinyl-plush-doll');if(m)console.log(m.url);")
if [ -z "$LINK" ]; then echo 'SERP miss'; kill $CHAIN_PID; exit 1; fi

# Section 6: web2md
node webpage-to-markdown.js "$LINK" | tee "$PAGE_MD"
grep -F "October 31, 2022" "$PAGE_MD" >/dev/null || { echo 'Missing date'; kill $CHAIN_PID; exit 1; }

kill $CHAIN_PID
echo "PASS"
