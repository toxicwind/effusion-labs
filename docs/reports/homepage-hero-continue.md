# Continuation – Homepage Hero

## Context Recap
Homepage hero rebuilt with value proposition, dual CTAs, and a three-tile bento. Legacy logo and provenance line removed.

## Outstanding Items
1. Integrate work feed filters into homepage.
2. Add animated lab seal flourish.

## Execution Strategy
Implement filter toolbar and badge animation with prefers-reduced-motion safeguard.

## Trigger Command
NODE_OPTIONS=--import=./test/setup/http.mjs node --test test/integration/homepage.spec.mjs
