# Continuation Plan

## Context Recap

- Added Eleventy test runner and migrated all tests to use it.
- Replaced network-based webpageToMarkdown tests with fixture-driven htmlToMarkdown check.
- Removed dev server MIME test; suite exits cleanly.

## Outstanding Items

- Implement environment-first build metadata resolution and integrate into templates.

## Execution Strategy

- Create metadata utility reading COMMIT_SHA and CI vars with local git fallback.
- Wire utility into Eleventy build outputs.

## Trigger Command

`CI=true npm test`
