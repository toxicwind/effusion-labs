# DEVNOTES

- **Tailwind entry**: `src/styles/app.tailwind.css` imports Tailwind and registers daisyUI via CSS `@plugin`.
- **Themes**: Edit the `@plugin "daisyui" { themes: ... }` block in `src/styles/app.tailwind.css` to add or override themes. Default light/dark handled by daisyUI tokens.
- **Toggle persistence**: Root `<html>` sets `data-theme`; selection stored in `localStorage` and read on first paint with no flash.
- **Snapshots**: Vendor docs cached under `docs/vendor/{daisyui,tailwind}/`.
- **Authority sources**: `node_modules/tailwindcss` and `node_modules/daisyui` define official tokens and plugin entrypoints.
