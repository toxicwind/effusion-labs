import fs from 'node:fs/promises'; // Use the promises API for async operations
import path from 'node:path';
import postcss from 'postcss';
import loadPostcssPlugins from './postcssPlugins.mjs';

/**
 * Compiles a CSS file using PostCSS with plugins from the project config.
 * Skips processing when the destination is newer than the source in production.
 *
 * @param {string} inputPath  Source CSS file path
 * @param {string} outputPath Destination path for compiled CSS
 * @returns {Promise<void>}
 */
export default async function runPostcss(inputPath, outputPath) {
  const isDev = process.env.ELEVENTY_SERVE === 'true' || process.env.NODE_ENV !== 'production';

  // In production, check if the output file is already up-to-date
  if (!isDev) {
    try {
      const [inputStat, outStat] = await Promise.all([
        fs.stat(inputPath),
        fs.stat(outputPath)
      ]);
      // If the output file exists and is newer than the input file, skip processing
      if (outStat.mtimeMs >= inputStat.mtimeMs) {
        console.log(`[PostCSS] Skipping ${inputPath} (already up-to-date).`);
        return;
      }
    } catch (error) {
      // If the output file doesn't exist, stat will throw an error, which is fine.
      // We just continue to process the file.
      if (error.code !== 'ENOENT') {
        throw error; // Re-throw any other type of error
      }
    }
  }

  try {
    const css = await fs.readFile(inputPath, 'utf8');
    const plugins = await loadPostcssPlugins();
    const result = await postcss(plugins).process(css, {
      from: inputPath,
      to: outputPath,
      map: { inline: true }
    });

    // Ensure the output directory exists before writing the file
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, result.css);

    console.log(`[PostCSS] Compiled ${inputPath} -> ${outputPath}`);
  } catch (error) {
    console.error(`[PostCSS Error] Failed to process ${inputPath}:`, error);
    throw error; // Re-throw the error to be handled by the caller
  }
}

/**
 * Compile multiple CSS files sequentially via PostCSS.
 *
 * @param {Array<{ src: string, dest: string }>} entries
 * Files to process: each object should define `src` and `dest` paths.
 * @returns {Promise<void>}
 */
export async function runPostcssAll(entries = []) {
  for (const { src, dest } of entries) {
    await runPostcss(src, dest);
  }
}