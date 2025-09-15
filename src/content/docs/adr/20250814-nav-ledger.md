# ADR: Nav Ledger Order

## Context

Navigation presented heavy chrome and lacked explicit hierarchy. Strategy card
_Seamful Navigation_ with traits _Scale-as-Hierarchy_ and _Archive-Purity_
guided a text-first ledger approach.

## Decision

Add sequential `order` metadata to navigation items and render header navigation
as a simple ordered list, exposing numbers directly in the UI.

## Consequences

- Navigation reads as a ledger and reveals structure without extra chrome.
- Numbers provide an immediate hierarchy cue for keyboard navigation.
