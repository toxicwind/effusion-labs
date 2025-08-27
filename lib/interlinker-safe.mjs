// lib/eleventy/interlinker-safe.mjs
import interlinker from "@photogabble/eleventy-plugin-interlinker";

/**
 * Wrapper around @photogabble/eleventy-plugin-interlinker
 * - Normalizes Eleventy 3.x data objects into strings
 * - Prevents "document.match is not a function" crash
 */
export default function interlinkerSafe(eleventyConfig) {
  return interlinker(eleventyConfig, {
    defaultLayout: "layouts/embed.njk",
    resolvingFns: new Map([
      [
        "default",
        (link) => {
          const href = link.href || link.link;
          const label = link.title || link.name;
          return `<a class="interlink" href="${href}">${label}</a>`;
        },
      ],
    ]),
    deadLinkReport: "json",

    // Normalization hook: make sure the plugin always gets a string
    preProcess: (input) => {
      if (typeof input === "string") return input;
      if (input && typeof input === "object") {
        // try to grab content first
        if ("content" in input) return String(input.content ?? "");
        // fallback: JSON-stringify the object
        return JSON.stringify(input);
      }
      return "";
    },
  });
}
