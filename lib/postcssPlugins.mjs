import postcssConfig from '../postcss.config.mjs';

export default async function loadPostcssPlugins() {
  const plugins = postcssConfig.plugins || [];
  if (Array.isArray(plugins)) return plugins;
  const loaded = await Promise.all(
    Object.entries(plugins).map(async ([name, opts]) => (await import(name)).default(opts)),
  );
  return loaded;
}
