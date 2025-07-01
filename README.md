# Effusion Labs Knowledge Lab

Effusion Labs is a structured, longform digital garden and idea incubation environment. Built atop Eleventy and powered by bidirectional linking, it enables recursive exploration of concepts, projects, sparks, and meta-level knowledge maps.

---

## 🛠️ Core Technology

- **Generator**: [Eleventy (11ty)](https://www.11ty.dev/)
- **Linking**: [`@photogabble/eleventy-plugin-interlinker`](https://github.com/photogabble/eleventy-plugin-interlinker) handles all wikilink and backlink resolution.
- **Graph Map**: The `/map/` page renders a real-time network of interlinked documents via [`vis.js`](https://visjs.org/) and `src/_data/conceptMapData.js`.

---

## 🚀 Getting Started (Local Dev)

1. Install dependencies  
   ```bash
   npm install
````

2. Run the Eleventy dev server

   ```bash
   npx @11ty/eleventy --serve
   ```

3. Open [http://localhost:8080](http://localhost:8080)

---

## 📦 Production Deployment

This repository includes a GitHub Actions CI pipeline and Docker configuration for automated production deployment via Portainer.

### 🔧 CI/CD Pipeline

On `main` push, the pipeline:

* Builds the Eleventy site
* Copies `_site/` into the Docker context
* Builds a Docker image with `nginx` serving static files
* Pushes to GitHub Container Registry (GHCR)

Image output:

```
ghcr.io/toxicwind/effusion-labs:latest
```

### 🔄 Portainer Integration

You can pull and deploy directly from Portainer using the above GHCR image. It uses a hardened `nginx.conf` for static file delivery with caching and fallback.

---

## 🗂 Directory Summary

* `/src/` — Source content files (markdown, templates)
* `/_site/` — Generated output (ignored in repo)
* `.github/workflows/` — GitHub Actions pipeline
* `.portainer/` — Docker context: `Dockerfile`, `nginx.conf`, and build output
* `conceptMapData.js` — Node-edge dataset for knowledge graph

---

## 🛰️ Deployment Notes

To build and deploy automatically via GitHub:

1. Push to `main` branch
2. Portainer (with GHCR enabled) will pull `ghcr.io/toxicwind/effusion-labs:latest`
3. Serve via exposed container port (e.g. `:80`) or reverse proxy

---

## 🧪 Optional Local Container Testing

You may run the Docker container locally to preview the production config:

```bash
docker build -t effusion-labs .portainer
docker run --rm -p 8080:80 effusion-labs
```

Then open [http://localhost:8080](http://localhost:8080)

---

## 📄 License

MIT License. See [LICENSE](./LICENSE) for full terms.