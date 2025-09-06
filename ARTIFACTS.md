# ARTIFACTS — Résumé Site 2025 — Assertive Build

- Branch: `feat/resume-2025-assertive-themes`
- Scope: Eleventy + Tailwind v4 + daisyUI v5

## Deliverables

- Themes: business (default), night, abyss — radios in sticky top bar and footer; persists to `localStorage`; supports `?theme=`.
- Geometry: `<html class="assertive-geometry">` — square corners, card borders 2–3px (night/abyss bolder), accent rail +1px, chunkier badges.
- Rhythm & hierarchy: unified section headings, consistent card paddings, low‑depth shadows, crisp borders using theme tokens.
- Experience: subgrid alignment (title, dates, bullets on steady tracks) with lean markup.
- Adaptivity: Projects grid and Skills/Tools chip sizes respond via container queries (28rem, 56rem breakpoints).
- Case studies: `/projects/patent-intelligence-agent/` and `/projects/llm-release-watcher/` linked from project cards.
- A11y: Underlines on hover, WCAG‑minded borders/contrast across themes, reduced‑motion disables micro‑transitions.
- Print: Existing print button yields a tidy one‑column flow.

## Touched Files

- `src/styles/app.tailwind.css`
- `src/content/resume.njk`
- `src/_data/resume.json`
- `src/content/now.njk`
- `src/content/uses.njk`
- `src/content/projects/patent-intelligence-agent.njk`
- `src/content/projects/llm-release-watcher.njk`

## Build

1. `node_modules/.bin/postcss src/styles/app.tailwind.css -o src/assets/css/app.css`
2. `npm run build`

## Notes

- Only built‑in daisyUI themes are used. Color remains theme‑driven; geometry changes do not alter palettes.
- Container queries keep markup lean; JS limited to theme persistence and meta `color-scheme` updates.
