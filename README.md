# Effusion Labs

A digital studio and knowledge base powered by Eleventy.

## Stack

- Eleventy v3 with Vite
- Tailwind v4 + daisyUI v5
- Node ≥24 ESM

## Quickstart

```bash
npm install
npm run dev   # start dev server
npm run build # generate _site/
```

## Scripts

| Script   | Purpose                           |
| -------- | --------------------------------- |
| `dev`    | Serve site with Eleventy + Vite   |
| `build`  | Produce static site in `_site/`   |
| `check`  | Run format check, lint, and tests |
| `test`   | Run integration tests             |
| `format` | Format code with Prettier         |
| `lint`   | Check markdown links              |

## Folders

```
config/      build & site config
utils/       dev and build helpers
src/content/ markdown & Nunjucks pages
src/assets/  source assets → /assets/
test/        integration and unit tests
```

Content lives in `src/content/`; assets from `src/assets/` emit to `/assets/`; build output `_site/`.

For autonomous details → see [AGENTS.md](AGENTS.md).

## Contributing

Run `npm run check` before committing and keep patches focused.

## License

[ISC](LICENSE)
