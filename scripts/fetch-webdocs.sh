#!/bin/bash
set -e
mkdir -p docs/webdocs
curl -L https://tailwindcss.com/docs > docs/webdocs/tailwind-docs.html
curl -L https://daisyui.com/components/ > docs/webdocs/daisyui-components.html
curl -L https://daisyui.com/docs/config/ > docs/webdocs/daisyui-config.html
DATE=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
cat <<EOD > docs/webdocs/README.md
# Saved Web Docs

These HTML snapshots are fetched automatically to ensure offline reference of Tailwind CSS and DaisyUI documentation.

- \`tailwind-docs.html\` – Tailwind CSS official documentation index.
- \`daisyui-components.html\` – DaisyUI components overview page.
- \`daisyui-config.html\` – DaisyUI configuration options.

Fetched on ${DATE}.
EOD
