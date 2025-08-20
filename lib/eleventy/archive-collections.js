import fs from 'node:fs';
import path from 'node:path';

const TYPES = ["products", "series", "characters"];
const fsJoin = path.join;

export function camelize(slug) {
  return slug
    .replace(/^the-/, "")
    .split("-")
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");
}

export default function registerArchiveCollections(eleventyConfig) {
  const fsBase = fsJoin("src", "content", "archives");

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
          fs
            .readdirSync(fsDir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => ({
              data: JSON.parse(fs.readFileSync(fsJoin(fsDir, f), "utf8")),
            })),
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
