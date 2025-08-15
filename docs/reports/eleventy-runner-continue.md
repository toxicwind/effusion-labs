# Continuation Plan

## Context Recap
- Added Eleventy test runner and migrated all tests to use it.
- Replaced network-based webpageToMarkdown tests with fixture-driven htmlToMarkdown check.

## Outstanding Items
- Responsive image tests still rely on heavy transforms and fail under default test mode.

## Execution Strategy
- Replace image network tests with fixtures or toggle heavy plugins only where required.

## Trigger Command
`CI=true npm test`
