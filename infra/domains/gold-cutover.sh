#!/usr/bin/env bash
# GOLD cutover kit — effusionlabs.com + estate subdomains.
# Runs the moment DNS control returns (registrar NS cutover off the hijacked
# CF account). Idempotent: safe to re-run.
#
# Lanes:
#   blue  = GitHub Pages  https://toxicwind.github.io/effusion-labs/  (LIVE now)
#   green = origin 172.96.160.178 (existing flicker pipeline, untouched)
#   gold  = custom domains: effusionlabs.com + <product>.mildlyawesome.com
#
# Requires: a DNS API token in the env (CLOUDFLARE_DNS_TOKEN for a CLEAN
# account we own, or NAMECHEAP_API_KEY). Never commit tokens.
set -euo pipefail

PAGES_IPS=(185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153)
PAGES_IPV6=(2606:50c0:8000::153 2606:50c0:8001::153 2606:50c0:8002::153 2606:50c0:8003::153)

# Subdomain plan: product surface → Pages target (or origin lane)
# kappa.mildlyawesome.com → toxicwind.github.io (kappa product surface)
SUBDOMAINS=(
  "kappa.mildlyawesome.com"
  "tau.mildlyawesome.com"
)

echo "== gold cutover plan =="
echo "apex  effusionlabs.com      -> A ${PAGES_IPS[*]}"
echo "www   www.effusionlabs.com  -> CNAME toxicwind.github.io"
for s in "${SUBDOMAINS[@]}"; do
  echo "sub   $s -> CNAME toxicwind.github.io"
done

# --- Cloudflare lane (clean account only — NEVER the attacker account) ---
if [[ -n "${CLOUDFLARE_DNS_TOKEN:-}" && -n "${CLOUDFLARE_ZONE_ID:-}" ]]; then
  api() { curl -s -X "$1" "https://api.cloudflare.com/client/v4$2" \
    -H "Authorization: Bearer $CLOUDFLARE_DNS_TOKEN" \
    -H "Content-Type: application/json" ${3:+-d "$3"}; }

  for ip in "${PAGES_IPS[@]}"; do
    api POST "/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
      "{\"type\":\"A\",\"name\":\"effusionlabs.com\",\"content\":\"$ip\",\"ttl\":300,\"proxied\":false}" >/dev/null
  done
  api POST "/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
    '{"type":"CNAME","name":"www","content":"toxicwind.github.io","ttl":300,"proxied":false}' >/dev/null
  for s in "${SUBDOMAINS[@]}"; do
    local_name="${s%%.mildlyawesome.com}"
    api POST "/zones/$CLOUDFLARE_ZONE_ID/dns_records" \
      "{\"type\":\"CNAME\",\"name\":\"$local_name\",\"content\":\"toxicwind.github.io\",\"ttl\":300,\"proxied\":false}" >/dev/null
  done
  echo "cloudflare records created (zone $CLOUDFLARE_ZONE_ID)"
else
  echo "no DNS token in env — printing records only (dry-run)"
fi

# --- verification (route contract: end-to-end, not front door) ---
verify() {
  local url="$1" expect="$2"
  local code body
  code=$(curl -s -o /tmp/gold-verify.out -w "%{http_code}" --max-time 10 "$url")
  body=$(head -c 200 /tmp/gold-verify.out)
  if [[ "$body" == *"$expect"* ]]; then echo "PASS $url ($code)"; else echo "FAIL $url ($code)"; fi
}
verify https://effusionlabs.com/ "effusion"
verify https://kappa.mildlyawesome.com/ "kappa"
