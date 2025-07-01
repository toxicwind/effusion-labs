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
* **Styling**: Tailwind CSS via [`eleventy-plugin-tailwindcss-4`  ](https://github.com/dwkns/eleventy-plugin-tailwindcss-4)
* **Graph view**: [`vis-network`](https://visjs.org/)

---

## Getting started

```bash
npm install                # install dependencies
npx @11ty/eleventy --serve # build and watch at http://localhost:8080
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
const interlinker = require("@photogabble/eleventy-plugin-interlinker");
const navigation  = require("@11ty/eleventy-navigation");
const tailwind    = require("eleventy-plugin-tailwindcss-4");

module.exports = eleventyConfig => {
  eleventyConfig.addPlugin(interlinker, { defaultLayout: "layouts/embed.njk" });
  eleventyConfig.addPlugin(navigation);
  eleventyConfig.addPlugin(tailwind, {
    input : "assets/css/tailwind.css",
    output: "assets/main.css",
    minify: true
  });

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

## What to learn next

* **Eleventy collections and layouts**: see `.eleventy.js` and the template files under `src/_includes`.
* **Wikilinks and backlinks**: explore how `@photogabble/eleventy-plugin-interlinker` resolves `[[wikilink]]` syntax.
* **Tailwind customisation**: edit `tailwind.config.cjs` and inspect the generated `assets/main.css`.
* **Graph rendering**: study `src/_data/conceptMapData.js` and `src/map.njk` to understand how the visualisation is built.
* **CI and container workflow**: review `.github/workflows/deploy.yml` alongside `.portainer/Dockerfile`.

---

## License

This project is released under the MIT License. See [`LICENSE`](./LICENSE) for details.
