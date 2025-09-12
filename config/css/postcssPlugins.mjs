// config/css/postcssPlugins.mjs
import postcssConfig from "../../postcss.config.mjs";

/** Load PostCSS plugins from our ESM config */
export default async function loadPostcssPlugins() {
  const plugins = postcssConfig.plugins || [];
  if (Array.isArray(plugins)) return plugins;

  // Object form: { 'plugin': options }
  const loaded = await Promise.all(
    Object.entries(plugins).map(async ([name, opts]) => (await import(name)).default(opts))
  );
  return loaded;
}
