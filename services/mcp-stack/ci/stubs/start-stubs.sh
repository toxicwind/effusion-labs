#!/bin/sh
set -eu
dir="$(dirname "$0")"
node "$dir/flaresolverr.js" &
p1=$!
node "$dir/searxng.js" &
p2=$!
node "$dir/screenshot.js" &
p3=$!
node "$dir/curl-proxy.js" &
p4=$!
wait $p1 $p2 $p3 $p4
