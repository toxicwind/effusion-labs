# 20250814-gateway-service

## Status
Accepted

## Context
We need an authenticated API gateway that proxies through FlareSolverr and returns cleaned Markdown.

## Decision
Implement a Flask-based gateway with Docker orchestration and a GitHub Actions workflow for builds.

## Consequences
- Provides Markdown conversion behind Cloudflare using FlareSolverr.
- CI workflow builds Docker image on push.
- Requires running Docker daemon for local builds.
