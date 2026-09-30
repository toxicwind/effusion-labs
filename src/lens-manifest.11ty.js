/**
 * lens-manifest.11ty.js — public observability endpoint for the autonomous
 * knowledge organism. Emits a slim summary of the build-time lens manifest
 * at /lens-manifest.json (full per-page analysis stays in src/_data).
 */
module.exports = class {
  data() {
    return {
      permalink: "/lens-manifest.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const manifest = data.lensManifest || { items: [] };
    const items = (manifest.items || []).map((item) => {
      const lr = item.lens_results || {};
      const consensus = lr.consensus || {};
      const lensNames = Object.keys(lr).filter((k) => k !== "consensus");
      return {
        path: item.path,
        title: item.title || null,
        lenses: lensNames,
        consensus: {
          status: consensus.status || "unknown",
          quorumMean: consensus.quorumMean ?? null,
          confidence: consensus.confidence ?? null,
          dissent: consensus.dissent ?? null,
        },
      };
    });
    return JSON.stringify(
      {
        generated: manifest.generated || null,
        organism: "effusion-labs autonomous knowledge organism",
        pages: items.length,
        items,
      },
      null,
      2
    );
  }
};
