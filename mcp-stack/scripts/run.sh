#!/bin/sh
export PROFILE=${PROFILE:-dev}
PORT_HTTP=${PORT_HTTP:-0} node gateway/index.js
