#!/usr/bin/env node
// tools/interlinker-discover.mjs
// Scan the repo to produce an agent-readable discovery file that drives the route registry.

import fs from 'node:fs';
import path from 'node:path';
import { routeRegistry } from '../lib/interlinkers/route-registry.mjs';

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function json(p) { try { return JSON.parse(read(p) || 'null'); } catch { return null; } }

const outDir = path.join('artifacts', 'reports');
const outPath = path.join(outDir, 'interlinker-discovery.json');

// Eleventy facts — collections, shortcodes, passthroughs
const eleventySrc = read('lib/eleventy/register.mjs') || '';
const collections = Array.from(eleventySrc.matchAll(/addCollection\(["'`](.+?)["'`]/g)).map(m => m[1]);
const shortcodes = Array.from(eleventySrc.matchAll(/addShortcode\(["'`](.+?)["'`]/g)).map(m => m[1]);
const passthroughs = Array.from(eleventySrc.matchAll(/addPassthroughCopy\(([^\n]+)\)/g)).map(m => m[1].trim());

// Plugin facts
const pkg = json('package.json') || {};
const installedVer = (pkg.devDependencies || {})['@photogabble/eleventy-plugin-interlinker'] || null;
const cjsPatched = fs.existsSync('patches/@photogabble+eleventy-plugin-interlinker+1.1.0.patch');

const defaultLocale = routeRegistry.defaultLocale || 'en';
const localePrefixes = !!routeRegistry.localePrefixEnabled;
const kinds = Object.entries(routeRegistry.kinds).filter(([kind]) => kind !== 'kinds').map(([kind, def]) => ({
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

const discovery = {
  eleventy: { collections, shortcodes, passthroughs },
  plugin: {
    name: '@photogabble/eleventy-plugin-interlinker',
    version: installedVer,
    loaderSurfaces: ['cjs','esm'],
    patched: { cjs: !!cjsPatched, esm: true },
  },
  scaffoldMap: kinds,
  i18n: { defaultLocale, localePrefixes },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(discovery, null, 2));
console.log('Wrote', outPath);
