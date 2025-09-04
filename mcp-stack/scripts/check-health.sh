#!/bin/sh
set -e
curl -fsS "http://localhost:${PORT_HTTP:-3000}/healthz" >/dev/null
