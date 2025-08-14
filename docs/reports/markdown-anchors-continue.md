# Continuation — markdown-anchors

## Context Recap
- test: added anchor demo and failing test.
- ci: recorded failing anchor test.
- feat: added markdown-it-anchor plugin.
- refactor: centralized plugin in markdown extensions.
- docs: ledger and continuation added.

## Outstanding Items
1. Add anchor link icons to headings
2. Expose anchored headings in table of contents

## Execution Strategy
1. Implement shortcode or CSS to reveal anchor icons next to headings; verify via DOM test.
2. Generate per-page table of contents using heading anchors; assert links match id attributes.

## Trigger Command
node --test tests/markdown-anchor.spec.mjs
