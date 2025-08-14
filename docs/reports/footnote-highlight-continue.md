# Continuation Plan - footnote-highlight

## Context Recap
- Footnote navigation now uses Tailwind CSS highlight and respects reduced motion.

## Outstanding Items
1. Load footnote script only on pages that require it.
2. Expand tests for keyboard navigation and ARIA labels.

## Execution Strategy
- Add Eleventy data flag and layout condition.
- Extend jsdom tests to verify keyboard/ARIA behavior.

## Trigger Command
npm test
