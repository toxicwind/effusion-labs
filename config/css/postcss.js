// config/css/postcss.js
import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import loadPostcssPlugins from "./postcssPlugins.mjs";

export default async function runPostcss(inputPath, outputPath) {
  const isDev = process.env.ELEVENTY_SERVE === "true" || process.env.NODE_ENV !== "production";

  if (!isDev) {
    try {
      const [inputStat, outStat] = await Promise.all([fs.stat(inputPath), fs.stat(outputPath)]);
      if (outStat.mtimeMs >= inputStat.mtimeMs) {
        console.log(`[PostCSS] Skipping ${inputPath} (up to date)`);
        return;
      }
    } catch (err) {
      if (err?.code !== "ENOENT") throw err;
    }
  }

  const css = await fs.readFile(inputPath, "utf8");
  const plugins = await loadPostcssPlugins();
  const start = Date.now();

  const result = await postcss(plugins).process(css, {
    from: inputPath,
    to: outputPath,
    map: isDev ? { inline: true } : false,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, result.css);

  const ms = Date.now() - start;
  console.log(`[PostCSS] ${path.basename(inputPath)} → ${path.relative(process.cwd(), outputPath)} (${ms}ms)`);
}

export async function runPostcssAll(entries = []) {
  for (const { src, dest } of entries) {
    await runPostcss(src, dest);
  }
}
