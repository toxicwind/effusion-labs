export default async function loadPostcssPlugins() {
  const { default: config } = await import('../postcss.config.cjs');
  const plugins = config.plugins || [];
  if (Array.isArray(plugins)) return plugins;
  const loaded = await Promise.all(
    Object.entries(plugins).map(async ([name, opts]) => (await import(name)).default(opts)),
  );
  return loaded;
}
