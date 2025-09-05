#!/usr/bin/env node
// tools/interlinker-hotfix-discover.mjs
// Produce a machine-readable artifact with Interlinker concrete entrypoints,
// sentinel presence, Eleventy collections/global data, and i18n defaults.

import fs from 'node:fs';
import path from 'node:path';
import { routeRegistry } from '../lib/interlinkers/route-registry.mjs';

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function json(p) { try { return JSON.parse(read(p) || 'null'); } catch { return null; } }

const OUT_DIR = path.join('artifacts', 'reports');
const OUT_PATH = path.join(OUT_DIR, 'interlinker-hotfix-discovery.json');
const PKG = '@photogabble/eleventy-plugin-interlinker';
const SENTINEL = 'ARACA-INTERLINKER-HOTFIX-V3';

function resolvePlugin() {
  const base = path.join('node_modules', PKG);
  const pkg = json(path.join(base, 'package.json')) || {};
  const esmRel = (pkg?.exports && (pkg.exports.import || pkg.module)) || 'index.js';
  const cjsRel = (pkg?.exports && (pkg.exports.require || pkg.main)) || 'index.cjs';
  const esmPath = path.join(base, esmRel);
  const cjsPath = path.join(base, cjsRel);
  const esm = read(esmPath) || '';
  const cjs = read(cjsPath) || '';
  const util = read(path.join(base, 'src', 'util.js')) || '';
  return {
    name: PKG,
    version: pkg.version || null,
    entrypoints: { esm: esmPath, cjs: cjsPath },
    sentinel: {
      string: SENTINEL,
      esm: esm.includes(SENTINEL) || util.includes(SENTINEL),
      cjs: cjs.includes('toHtmlString(') && cjs.includes('safeMatch('),
    },
  };
}

function discoverEleventy() {
  const src = read('lib/eleventy/register.mjs') || '';
  const collections = Array.from(src.matchAll(/addCollection\(["'`](.+?)["'`]/g)).map(m => m[1]);
  const globals = Array.from(src.matchAll(/addGlobalData\(["'`](.+?)["'`]/g)).map(m => m[1]);
  const passthroughs = Array.from(src.matchAll(/addPassthroughCopy\(([^\n]+)\)/g)).map(m => m[1].trim());
  return { collections, globals, passthroughs };
}

function scaffoldMapFromRegistry() {
  return Object.entries(routeRegistry.kinds).map(([kind, def]) => ({
    kind,
    base: def.basePath,
    datasetKeys: def.datasetKeys,
    keyFields: def.keyFields,
    canonicalBase: def.basePath,
    canonicalField: def.keyFields?.[0] || null,
    aliasFields: ['slugAliases[]','legacyPaths[]'],
    legacyPathFields: ['legacyPaths[]'],
    idTitleFallbacks: ['id','title'],
  }));
}

function run() {
  const plugin = resolvePlugin();
  const eleventy = discoverEleventy();
  const i18n = { defaultLocale: routeRegistry.defaultLocale, localePrefixes: !!routeRegistry.localePrefixEnabled };
  const payload = { plugin, eleventy, i18n, scaffoldMap: scaffoldMapFromRegistry() };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));
  console.log('Wrote', OUT_PATH);
}

run();

