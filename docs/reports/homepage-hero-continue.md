# Continuation – Homepage Hero

## Context Recap
Homepage hero now includes branded logo, restored concept map call-to-action, refactored lab seal, and a multi-column work feed with hover/focus affordance.

## Outstanding Items
1. Integrate rich metadata into Work collection and add showcase article.
2. Enforce fluid type scale and 8px spacing with full accessibility pass.

## Execution Strategy
Implement metadata extraction and showcase article, then apply typography and accessibility refinements.

## Trigger Command
NODE_OPTIONS=--import=./test/setup/http.mjs node --test test/integration/homepage.spec.mjs test/integration/homepage-latest.spec.mjs
