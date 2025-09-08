# DEVNOTES

- **Tailwind entry**: `src/styles/app.tailwind.css` imports Tailwind and registers daisyUI via CSS `@plugin`.
- **Themes**: Edit the `@plugin "daisyui" { themes: ... }` block in `src/styles/app.tailwind.css` to add or override themes. Default light/dark handled by daisyUI tokens.
- **Toggle persistence**: Root `<html>` sets `data-theme`; selection stored in `localStorage` and read on first paint with no flash.
- **Snapshots**: Vendor docs cached under `docs/vendor/{daisyui,tailwind}/`.
- **Authority sources**: `node_modules/tailwindcss` and `node_modules/daisyui` define official tokens and plugin entrypoints.

## Component Canon

| Primitive | daisyUI class | Module | Tokens |
| --- | --- | --- | --- |
| Button | `btn` | `src/styles/components/button.css` | `--tw-shadow` reset |
| Badge | `badge` | `src/styles/components/badge.css` | n/a |
| Alert | `alert` | `src/styles/components/alert.css` | n/a |
| Navbar | `navbar` + `.link-underline` | `src/styles/components/navbar.css` | `currentColor` underline |
| Card | `card` | `src/styles/components/card.css` | `--tw-shadow` reset |
| Modal | `modal` | `src/styles/components/modal.css` | n/a |
| Pagination | `.pagination` | `src/styles/components/pagination.css` | n/a |
| Breadcrumb | `breadcrumb` | `src/styles/components/breadcrumb.css` | n/a |
| Form controls | `input`, `select`, `textarea` | `src/styles/components/form-controls.css` | `--tw-shadow` reset |

### Module layout & order
`src/styles/app.tailwind.css` imports modules in a fixed sequence:

1. Tailwind base
2. daisyUI plugin with light/dark themes
3. `tokens.css`
4. `base/reset.css`
5. `base/typography.css`
6. Components (alphabetical)
7. Utilities (`animations.css`, `layout.css`, `zindex.css`)
8. Theme overrides (`themes/overrides.light.css`, `themes/overrides.dark.css`)

### Showcase enhancement
Navbar links use `.link-underline` for a subtle animated underline on hover, demonstrating modular composition.
