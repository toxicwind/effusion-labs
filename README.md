# Effusion Labs

[![deploy](https://img.shields.io/github/actions/workflow/status/effusion-labs/effusion-labs/deploy.yml?branch=main)](https://github.com/effusion-labs/effusion-labs/actions/workflows/deploy.yml)

Effusion Labs is a Node 20–powered Eleventy studio for publishing research and prototypes with Nunjucks templates and Tailwind CSS.

## Features
- Eleventy static site generator with custom collections and filters.
- Nunjucks templates and Tailwind CSS theme configured via PostCSS.
- Seeded shuffling utilities for deterministic randomness.
- Markdown Gateway service for authenticated web‑to‑Markdown conversion.

## Quickstart
Requires Node.js 20 or later.
### Clone and Install
```bash
git clone https://github.com/effusion-labs/effusion-labs.git
cd effusion-labs
npm ci
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Tests
```bash
npm test
```

## Project Layout
```
.
├── .github/
│   └── workflows/
├── lib/
│   └── eleventy/
├── markdown_gateway/
├── src/
│   ├── _data/
│   ├── _includes/
│   ├── archives/
│   ├── assets/
│   ├── content/
│   └── styles/
├── tests/
│   └── helpers/
├── tools/
│   └── shared/
```

## Deployment
### Local Container
```bash
docker compose up -d
```
Serves the site on http://localhost:18400.

### CI Pipeline
Tests run on GitHub Actions, followed by a build that pushes container images to GitHub Container Registry and triggers redeploy via Portainer webhooks.

## Services
- [Markdown Gateway](markdown_gateway/README.md)

## Testing & Contributing
`npm test` uses a capability‑driven runner that targets only tests related to changed files and separates Node and browser specs.
Run a specific test:
```bash
npm test tests/header-nav-aria.spec.mjs
```
Run the provenance audit:
```bash
node tools/provenance-audit.mjs
```
Validate links:
```bash
npm run docs:links
```
Please ensure tests and link checks pass before opening a pull request.

## License
[ISC](LICENSE)
