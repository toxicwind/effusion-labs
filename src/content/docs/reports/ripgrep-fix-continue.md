# Continuation: ripgrep-fix

## Context Recap

`@vscode/ripgrep` caused GitHub 403 errors during `npm ci`. The dependency was
removed and docs updated.

## Outstanding Items

1. Optionally provide cross-platform ripgrep acquisition script.
2. Investigate failing browser tests.

## Execution Strategy

Implement optional ripgrep detection script using local binaries; stabilize
browser tests with required dependencies.

## Trigger Command

`npm test`
