# 20250814-feed-build-metadata

## Status

Accepted

## Context

The RSS feed lacked explicit provenance, limiting transparency and cache friendliness.

## Decision

Expose commit hash and build timestamp via Eleventy global data and render them within the feed template.

## Consequences

- Reveals build origin for consumers and debuggers.
- Enables deterministic feed metadata for external caches.
