# Effusion Labs Digital Garden

Effusion Labs is a structured, long-form digital garden built with [Eleventy](https://www.11ty.dev/).  
The site supports bidirectional linking, knowledge-graph visualisation, and containerised deployment so that ideas can evolve in place while remaining easy to publish.

---

## Repository structure

| Path | Purpose |
|------|---------|
| `src/` | Markdown content, Nunjucks templates, and data files |
| `_site/` | Generated output created by Eleventy (ignored by Git) |
| `.github/workflows/` | Continuous-integration pipeline |
| `.portainer/` | Production container context including `Dockerfile` and `nginx.conf` |

---

## Core technology stack

* **Site generator**: Eleventy  
* **Bidirectional linking**: [`@photogabble/eleventy-plugin-interlinker`](https://github.com/photogabble/eleventy-plugin-interlinker)  
* **Styling**: Tailwind CSS via [`eleventy-plugin-tailwindcss-4`  ](https://github.com/dwkns/eleventy-plugin-tailwindcss-4) with [daisyUI](https://daisyui.com) v5 components and an autoprefixed PostCSS pipeline
* **Syntax highlighting**: [`@11ty/eleventy-plugin-syntaxhighlight`](https://github.com/11ty/eleventy-plugin-syntaxhighlight)
* **Sitemap generation**: [`@quasibit/eleventy-plugin-sitemap`](https://github.com/quasibit/eleventy-plugin-sitemap)
* **Graph view**: [`vis-network`](https://visjs.org/)

The Tailwind setup includes [daisyUI](https://daisyui.com) v5 with a custom theme defined in `tailwind.config.cjs`.

---

## Getting started

```bash
npm install                # install dependencies
npm run dev                # build and watch at http://localhost:8080
````

---

## Production pipeline

A push to `main` triggers **GitHub Actions**:

1. Run the Eleventy build and copy `_site/` into the container context.
2. Build an Nginx image and push it to GitHub Container Registry at
   `ghcr.io/<OWNER>/effusion-labs:latest`.

You can deploy the image with Portainer or any Docker host:

```bash
docker run --rm -p 8080:80 ghcr.io/<OWNER>/effusion-labs:latest
```

The bundled `nginx.conf` serves static assets with cache headers and falls back to `index.html` for client-side navigation.

---

## Eleventy configuration highlights

Key customisation is in `.eleventy.js`:

```js
const getPlugins = require("./lib/plugins");
const filters    = require("./lib/filters");

module.exports = eleventyConfig => {
  getPlugins().forEach(([plugin, opts]) => eleventyConfig.addPlugin(plugin, opts));
  Object.entries(filters).forEach(([name, fn]) => eleventyConfig.addFilter(name, fn));

  ["sparks", "concepts", "projects", "meta"].forEach(group =>
    eleventyConfig.addCollection(group, api =>
      api.getFilteredByGlob(`src/content/${group}/**/*.md`)
    )
  );
};
```

---

## Interactive concept map

`src/map.njk` converts Eleventy collections into a node–edge list consumed by `vis-network`.
Opening `/map/` reveals how Sparks, Concepts, Projects, and Meta documents interconnect, enabling exploratory browsing.

---

## RSS feed

A site-wide feed is available at `/feed.xml` for following updates in your preferred reader.

---

## Sitemap

An automatically generated sitemap is produced at `/sitemap.xml` to help search engines discover content.

---

## License

This project is released under the MIT License. See [`LICENSE`](./LICENSE) for details.
