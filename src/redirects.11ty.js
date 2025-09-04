/**
 * Generates a Netlify-compatible _redirects file mapping legacy product paths
 * and alias slugs to canonical /archives/product/<slugCanonical>/.
 */
export const data = {
  permalink: '/_redirects',
  eleventyExcludeFromCollections: true,
};

export default function (data) {
  const on = (process.env.ARCHIVE_CANON_ROUTES ?? 'true') !== 'false';
  if (!on) return '';
  const items = data.archiveProductMap || [];
  const lines = [];
  for (const it of items) {
    const target = it.canonicalUrl;
    const set = new Set([...(it.legacyPaths || [])]);
    for (const a of it.slugAliases || []) set.add(`/archives/product/${a}/`);
    for (const from of set) {
      if (!from || from === target) continue;
      lines.push(`${from}  ${target}  308!`);
    }
  }
  return lines.sort().join('\n') + '\n';
}
