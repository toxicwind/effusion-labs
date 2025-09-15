# 20250813-hero-image-perf

## Status

Accepted

## Context

Hero logo used default lazy loading which delayed first paint.

## Decision

Load logo eagerly with high fetch priority and explicit 112px dimensions;
centralize values in branding data.

## Consequences

Improves initial render performance; tests guard the attributes for future
changes.
