#!/usr/bin/env node
// Node 18+ ESM
import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();
const ROOT = CWD;
const ELEVENTY_CFG = path.join(ROOT, 'eleventy.config.mjs');
const OUT = path.join(ROOT, 'eleventy.config.mjs.FLATTENED');
const CONFIG_DIR = path.join(ROOT, 'config');

const exts = new Set(['.mjs', '.js']);

const report = {
    timestamp: new Date().toISOString(),
    root: ROOT,
    input: path.relative(ROOT, ELEVENTY_CFG),
    output: path.relative(ROOT, OUT),
    configDir: path.relative(ROOT, CONFIG_DIR),
    filesDiscovered: [],
    filesInlined: [],
    importsRemoved: [],
    identifiersDeclared: {},
    collisions: [],
    orphans: [],
    notes: [
        'All code from config/ is inlined BEFORE the exported eleventy function.',
        'ESM exports were stripped (export default/const/function).',
        'Anonymous default exports were named after filename.',
    ],
};

function walk(dir) {
    return fsp.readdir(dir, { withFileTypes: true }).then(async (ents) => {
        const out = [];
        for (const ent of ents) {
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                out.push(...await walk(p));
            } else {
                const ext = path.extname(ent.name);
                if (exts.has(ext)) out.push(p);
            }
        }
        return out;
    });
}

function deriveNameFromFilename(absPath) {
    const base = path.basename(absPath).replace(/\.(mjs|js)$/i, '');
    // snake/kebab to camel
    return base.split(/[^a-zA-Z0-9]+/g).filter(Boolean).map((s, i) =>
        i === 0 ? s.replace(/^[A-Z]/, m => m.toLowerCase()) :
            s.charAt(0).toUpperCase() + s.slice(1)
    ).join('');
}

function stripExports(content, absPath) {
    const declared = [];

    // export default function NAME(
    content = content.replace(
        /export\s+default\s+function\s+([A-Za-z0-9_$]+)\s*\(/g,
        (_m, name) => { declared.push(name); return `function ${name}(`; }
    );

    // export default function (
    content = content.replace(
        /export\s+default\s+function\s*\(/g,
        (m) => {
            const name = deriveNameFromFilename(absPath) || 'defaultExport';
            declared.push(name);
            return `function ${name}(`;
        }
    );

    // export function NAME(
    content = content.replace(
        /export\s+function\s+([A-Za-z0-9_$]+)\s*\(/g,
        (_m, name) => { declared.push(name); return `function ${name}(`; }
    );

    // export const/let/var NAME =
    content = content.replace(
        /export\s+(const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g,
        (_m, kind, name) => { declared.push(name); return `${kind} ${name}=`; }
    );

    // export default { … }  → const <name> = { … }
    content = content.replace(
        /export\s+default\s+(\{[\s\S]*?\});?$/m,
        (_m, obj) => {
            const name = deriveNameFromFilename(absPath) || 'defaultExport';
            declared.push(name);
            return `const ${name} = ${obj};`;
        }
    );

    // export default <expr>;
    content = content.replace(
        /export\s+default\s+([^;]+);?/g,
        (_m, expr) => {
            const name = deriveNameFromFilename(absPath) || 'defaultExport';
            declared.push(name);
            return `const ${name} = ${expr};`;
        }
    );

    // export { a, b as c }
    content = content.replace(
        /export\s*\{[\s\S]*?\};?/g,
        (m) => {
            // We can’t reliably recover names here; they should have been declared above.
            return `/* inlined: ${m.trim()} */`;
        }
    );

    return { content, declared };
}

function splitHeaderBody(eleventyContent) {
    const match = eleventyContent.match(/^[\s\S]*?export\s+default\s+function\s*\(/m);
    if (!match) return { header: eleventyContent, body: '', idx: eleventyContent.length };
    const idx = match.index;
    return {
        header: eleventyContent.slice(0, idx),
        body: eleventyContent.slice(idx),
        idx,
    };
}

async function main() {
    // sanity
    if (!fs.existsSync(ELEVENTY_CFG)) {
        console.error(`Missing ${ELEVENTY_CFG}`);
        process.exit(1);
    }
    if (!fs.existsSync(CONFIG_DIR)) {
        console.error(`Missing ${CONFIG_DIR}`);
        process.exit(1);
    }

    const [eleventySrc, cfgFiles] = await Promise.all([
        fsp.readFile(ELEVENTY_CFG, 'utf8'),
        walk(CONFIG_DIR),
    ]);

    report.filesDiscovered = cfgFiles.map(p => path.relative(ROOT, p)).sort();

    const { header, body } = splitHeaderBody(eleventySrc);

    // Remove imports from ./config/*
    const importRx = /^\s*import\s+[\s\S]+?from\s+['"](?:\.{1,2}\/)?config\/[^'"]+['"];?\s*$/gm;
    const importsRemoved = (header.match(importRx) || []).slice();
    const cleanHeader = header.replace(importRx, '').replace(/\n{3,}/g, '\n\n');

    report.importsRemoved = importsRemoved.map(s => s.trim());

    // Inline each config file
    let inlinedBlob = '';
    const seenNames = new Set();

    for (const abs of cfgFiles.sort()) {
        const rel = path.relative(ROOT, abs);
        let src = await fsp.readFile(abs, 'utf8');

        const { content, declared } = stripExports(src, abs);

        // naive collision check
        for (const name of declared) {
            if (seenNames.has(name)) {
                report.collisions.push({ identifier: name, file: rel });
            } else {
                seenNames.add(name);
            }
            report.identifiersDeclared[name] ??= [];
            report.identifiersDeclared[name].push(rel);
        }

        inlinedBlob += `\n// ───────────────────────────────────────────────────────────────\n`;
        inlinedBlob += `// BEGIN inline: ${rel}\n`;
        inlinedBlob += `${content.trim()}\n`;
        inlinedBlob += `// END inline: ${rel}\n`;
        inlinedBlob += `// ───────────────────────────────────────────────────────────────\n`;

        report.filesInlined.push(rel);
    }

    // Compose final file
    const banner =
        `// eleventy.config.mjs (FLATTENED)
// Generated ${new Date().toISOString()}
// This file inlines prior modules from ./config/**. Do not edit the old files—remove them after verifying.
// Vite handles /public passthrough; no Eleventy passthrough for src/assets.

`;

    const newContent = `${banner}${cleanHeader}\n\n/* ==== Inlined config modules (from ./config) ==== */\n${inlinedBlob}\n/* ==== End inlined config modules ==== */\n\n${body}`;

    await fsp.writeFile(OUT, newContent, 'utf8');

    // Identify "orphans": files in config/ never referenced by old eleventy.config.mjs imports
    const importedRel = (importsRemoved.map(s => {
        const m = s.match(/from\s+['"]([^'"]+)['"]/);
        return m ? m[1].replace(/^[.\/]+/, '') : null;
    }).filter(Boolean) || []);
    const importedSet = new Set(importedRel.map(p => path.normalize(p)));

    // crude: if a file path (relative) contains a substring from importedSet basename, treat as referenced
    const referenced = new Set();
    for (const rel of report.filesDiscovered) {
        for (const imp of importedSet) {
            if (rel.includes(imp)) referenced.add(rel);
        }
    }
    report.orphans = report.filesDiscovered.filter(r => !referenced.has(r)).sort();

    // Output JSON report
    const json = JSON.stringify(report, null, 2);
    console.log(json);
}

main().catch(err => {
    console.error('[flatten-eleventy-config] error:', err);
    process.exit(1);
});
