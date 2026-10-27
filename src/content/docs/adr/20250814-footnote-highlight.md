# ADR: Move footnote highlight styling to Tailwind

## Context

Inline styles in `footnote-nav.js` duplicated Tailwind definitions and ignored reduced-motion
preferences.

## Decision

- Remove style injection from script.
- Define `.footnote-highlight` in `app.tailwind.css` using primary color token.
- Add reduced-motion checks and shared highlight helper.

## Consequences

- Consistent theming and easier customization.
- Tests verify no inline styles and accessible scroll behavior.
