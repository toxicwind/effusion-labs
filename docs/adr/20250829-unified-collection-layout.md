# 20250829-unified-collection-layout

## Status
Accepted

## Context
Sparks, Concepts, and Projects index pages duplicated listing markup and descriptions.

## Decision
Introduce `layouts/collection.njk` with centralized `sections` data to render collection pages from metadata.

## Consequences
- Eliminates template redundancy
- Simplifies section updates
