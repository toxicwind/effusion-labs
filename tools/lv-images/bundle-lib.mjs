import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as tar from "tar";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const datasetRoot = path.join(projectRoot, "src/content/projects/lv-images");
const generatedDir = path.join(datasetRoot, "generated");
const lvDir = path.join(generatedDir, "lv");
const bundlePath = path.join(generatedDir, "lv.bundle.tgz");
const manifestPath = path.join(generatedDir, "lv.bundle.json");
const urlmetaPath = path.join(lvDir, "cache", "urlmeta.json");
const summaryPath = path.join(lvDir, "summary.json");

const posixify = (value) => value.split(path.sep).join("/");
const rel = (from, to) => posixify(path.relative(from, to));

async function hashFile(filePath, algorithm = "sha256") {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function toRelativeCachePath(p) {
  if (!p) return "";
  const normalized = String(p).trim();
  if (!normalized) return "";
  const unixified = normalized.replace(/\\/g, "/");
  const marker = "/generated/lv/";
  const idx = unixified.indexOf(marker);
  if (idx !== -1) {
    const tail = unixified.slice(idx + marker.length).replace(/^\/+/, "");
    if (tail) return tail;
  }
  const abs = path.isAbsolute(normalized) ? normalized : path.resolve(lvDir, normalized);
  const relative = path.relative(lvDir, abs);
  if (!relative || relative.startsWith("..")) {
    return posixify(normalized);
  }
  return posixify(relative);
}

async function walkDatasetDir(dirRel, acc) {
  const target = path.join(lvDir, dirRel);
  let dirents;
  try {
    dirents = await readdir(target, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of dirents) {
    const childRel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
    const abs = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await walkDatasetDir(childRel, acc);
    } else if (entry.isFile()) {
      const s = await stat(abs);
      acc.push({ path: posixify(childRel), size: s.size });
    }
  }
}

export async function collectDatasetEntries() {
  const acc = [];
  await walkDatasetDir("", acc);
  return acc.sort((a, b) => a.path.localeCompare(b.path));
}

export async function normalizeUrlmetaPaths() {
  let data;
  try {
    const raw = await readFile(urlmetaPath, "utf8");
    data = raw ? JSON.parse(raw) : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return { changed: false, count: 0 };
    }
    throw error;
  }

  let changed = false;
  let count = 0;
  for (const meta of Object.values(data)) {
    if (!meta || !meta.path) continue;
    count++;
    const relPath = toRelativeCachePath(meta.path);
    if (relPath && meta.path !== relPath) {
      meta.path = relPath;
      changed = true;
    }
  }

  if (changed) {
    await writeFile(urlmetaPath, JSON.stringify(data, null, 2));
  }

  return { changed, count };
}

export async function bundleDataset({ skipIfMissing = false, quiet = false } = {}) {
  const entries = await collectDatasetEntries();
  if (entries.length === 0) {
    if (skipIfMissing) {
      if (!quiet) {
        console.warn(`[lv-images] No dataset found at ${lvDir}`);
      }
      return null;
    }
    throw new Error(`LV dataset missing at ${lvDir}`);
  }

  await normalizeUrlmetaPaths();
  await mkdir(generatedDir, { recursive: true });
  await tar.create({
    gzip: true,
    cwd: generatedDir,
    file: bundlePath,
    portable: true,
    noMtime: true,
  }, ["lv"]);

  const archiveStat = await stat(bundlePath);
  const sha256 = await hashFile(bundlePath);
  let summary = null;
  try {
    const raw = await readFile(summaryPath, "utf8");
    summary = raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const totalBytes = entries.reduce((sum, file) => sum + file.size, 0);
  const manifest = {
    generatedAt: new Date().toISOString(),
    dataset: {
      fileCount: entries.length,
      totalBytes,
    },
    archive: {
      path: rel(datasetRoot, bundlePath),
      size: archiveStat.size,
      sha256,
    },
    summary: summary
      ? {
          version: summary.version || null,
          generatedAt: summary.generatedAt || null,
          totals: summary.totals || null,
        }
      : null,
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}

export async function hydrateDataset({ force = true, quiet = false } = {}) {
  try {
    await access(bundlePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!quiet) {
        console.warn(`[lv-images] Bundle missing at ${bundlePath}`);
      }
      return { hydrated: false, reason: "missing-bundle" };
    }
    throw error;
  }

  if (force) {
    await rm(lvDir, { recursive: true, force: true });
  }

  await mkdir(generatedDir, { recursive: true });
  await tar.extract({ cwd: generatedDir, file: bundlePath, strip: 0 });
  await normalizeUrlmetaPaths();

  return { hydrated: true, reason: "ok" };
}

export async function verifyBundle() {
  let manifest;
  try {
    const raw = await readFile(manifestPath, "utf8");
    manifest = raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ok: false, reason: "missing-manifest" };
    }
    throw error;
  }

  if (!manifest) {
    return { ok: false, reason: "invalid-manifest" };
  }

  let bundleStat;
  try {
    bundleStat = await stat(bundlePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { ok: false, reason: "missing-bundle", manifest };
    }
    throw error;
  }

  const sha256 = await hashFile(bundlePath);
  const entries = await collectDatasetEntries();
  const totalBytes = entries.reduce((sum, file) => sum + file.size, 0);

  const mismatches = [];
  if (manifest.archive?.size != null && manifest.archive.size !== bundleStat.size) {
    mismatches.push("size");
  }
  if (manifest.archive?.sha256 && manifest.archive.sha256 !== sha256) {
    mismatches.push("sha256");
  }
  if (manifest.dataset?.fileCount != null && manifest.dataset.fileCount !== entries.length) {
    mismatches.push("fileCount");
  }
  if (manifest.dataset?.totalBytes != null && manifest.dataset.totalBytes !== totalBytes) {
    mismatches.push("totalBytes");
  }

  return {
    ok: mismatches.length === 0,
    manifest,
    actual: {
      archive: { size: bundleStat.size, sha256 },
      dataset: { fileCount: entries.length, totalBytes },
    },
    mismatches,
  };
}

export async function datasetStats() {
  const entries = await collectDatasetEntries();
  const totalBytes = entries.reduce((sum, file) => sum + file.size, 0);
  return {
    entries,
    totalBytes,
  };
}

export const paths = {
  projectRoot,
  datasetRoot,
  generatedDir,
  lvDir,
  bundlePath,
  manifestPath,
  urlmetaPath,
  summaryPath,
};

export default {
  bundleDataset,
  hydrateDataset,
  verifyBundle,
  datasetStats,
  normalizeUrlmetaPaths,
  collectDatasetEntries,
  paths,
};
