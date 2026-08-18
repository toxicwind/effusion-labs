const fs = require("fs");
const path = require("path");

const TYPES = ["products", "series", "characters"];
const fsJoin = path.join;

function camelize(slug) {
  return slug
    .replace(/^the-/, "")
    .split("-")
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");
}

function registerArchiveCollections(eleventyConfig) {
  const fsBase = fsJoin("src", "content", "archives");

  function uniqueByType(items, type) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const d = item?.data || {};
      let key = "";
      if (type === "products") {
        key = String(d.product_id || d.slugCanonical || d.productSlug || d.slug || "");
      } else if (type === "characters") {
        key = String(d.charSlug || d.slug || d.name || "");
      } else if (type === "series") {
        key = String(d.seriesSlug || d.slug || d.name || "");
      }
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  function scan(dirFs, parts = []) {
    const entries = fs.readdirSync(dirFs, { withFileTypes: true });
    const typeDirs = entries.filter(
      (e) => e.isDirectory() && TYPES.includes(e.name),
    );
    if (typeDirs.length) {
      const lineSlug = parts[parts.length - 1];
      const nameBase = camelize(lineSlug);
      for (const { name: type } of typeDirs) {
        const collName = `${nameBase}${type[0].toUpperCase()}${type.slice(1)}`;
        const fsDir = fsJoin(dirFs, type);
        eleventyConfig.addCollection(collName, () =>
          uniqueByType(
            fs
            .readdirSync(fsDir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => ({
              data: JSON.parse(fs.readFileSync(fsJoin(fsDir, f), "utf8")),
            })),
            type,
          ),
        );
      }
    } else {
      for (const entry of entries.filter((e) => e.isDirectory())) {
        scan(fsJoin(dirFs, entry.name), [...parts, entry.name]);
      }
    }
  }

  if (fs.existsSync(fsBase)) {
    scan(fsBase, []);
  }
}

module.exports = registerArchiveCollections;
module.exports._camelize = camelize;
