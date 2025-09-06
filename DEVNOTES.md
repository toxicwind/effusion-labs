# DEVNOTES

- Tailwind entry: `src/styles/app.tailwind.css` imports `tailwindcss`, declares `@source` globs, and registers daisyUI.
- Themes: `@plugin "daisyui" { themes: light --default, dark --prefersdark }`; toggle by setting `data-theme` on `<html>`.
- Toggle persistence: `src/scripts/theme-utils.js` (early init + storage) with `src/scripts/theme-toggle.js`.
- Vendor snapshots live in `docs/vendor/daisyui/` and `docs/vendor/tailwind/` (fetched 2025-09-06).
- Installed authority: `tailwindcss@4.1.12` and `daisyui@5.1.6` from `node_modules`.
