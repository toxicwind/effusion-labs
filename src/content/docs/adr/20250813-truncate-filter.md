# 20250813-truncate-filter

## Context

List item descriptions could be overly long. Need simple way to shorten.

## Decision

Introduce `truncate` filter that trims strings to specified length with ellipsis
and apply it to list item component.

## Consequences

Descriptions remain concise without extra styling.
