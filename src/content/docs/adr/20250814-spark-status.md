# 20250814-spark-status — expose spark status in listings

## Context

Sparks carried a `status` field that was hidden on collection pages.

## Decision

Append bracketed status text beside the type in the shared list item component.

## Consequences

Readers can see draft or stable states at a glance; regression covered by an automated test.
