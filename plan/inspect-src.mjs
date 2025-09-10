#!/usr/bin/env node
// plan/inspect-src.mjs
// Master refactor planner for src/ (with --dry / --do-it)

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import chalk from 'chalk';

const cwd = process.cwd();
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry') || !args.has('--do-it');
const DO_IT = args.has('--do-it');

const rel = p => p.replace(cwd + path.sep, '');
async function exists(p) { try { await fsp.access(p); return true; } catch { return false; } }
async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }
function ppMove(m) { return `- ${m.from}  ->  ${m.to}${m.note ? `  (${m.note})` : ''}`; }

const MOVES = [];
const CONFLICTS = [];
const TOUCHED = new Set();
const COUNTS = {
    rewrites_frontmatter_layout: 0,
    rewrites_includes_extends: 0,
    rewrites_assets: 0,
    rewrites_srcscripts: 0,
};

// Planned relocations (only applied if source exists)
const candidates = [
    ['src/_includes/layout.njk', 'src/_includes/layouts/base.njk', 'normalize base layout'],
    ['src/404.njk', 'src/pages/404.njk', 'endpoint → pages/'],
    ['src/index.njk', 'src/pages/index.njk', 'endpoint → pages/'],
    ['src/map.njk', 'src/pages/map.njk', 'endpoint → pages/'],
    ['src/feed.njk', 'src/pages/feed.njk', 'endpoint → pages/'],
    ['src/consulting.njk', 'src/pages/consulting.njk', 'endpoint → pages/'],
    ['src/concept-map.json.njk', 'src/pages/concept-map.json.njk', 'endpoint → pages/'],
    ['src/content/resume.njk', 'src/pages/resume/index.njk', 'resume endpoint'],
    ['src/content/resume-card.njk', 'src/pages/resume/card.njk', 'resume card endpoint'],
    ['src/work/drop.11ty.js', 'src/pages/work/drop.11ty.js', 'work endpoint'],
    ['src/work/latest.11ty.js', 'src/pages/work/latest.11ty.js', 'work endpoint'],
    ['src/work/index.njk', 'src/pages/work/index.njk', 'work endpoint (folder index)'],
    ['src/work.njk', 'src/pages/work/index.njk', 'work listing'],
    ['src/_includes/layouts/embed.njk', 'src/_includes/components/embed.njk', 'component, not layout'],
    ['src/_includes/archive-nav.njk', 'src/_includes/components/archive-nav.njk', 'component placement'],
    ['src/scripts/base.js', 'src/assets/js/base.js', 'js authoring → assets/js'],
    ['src/scripts/code-copy.js', 'src/assets/js/code-copy.js', 'js authoring → assets/js'],
    ['src/scripts/footnote-nav.js', 'src/assets/js/footnote-nav.js', 'js authoring → assets/js'],
    ['src/scripts/mschf-overlay.js', 'src/assets/js/mschf-overlay.js', 'js authoring → assets/js'],
    ['src/scripts/theme-toggle.js', 'src/assets/js/theme-toggle.js', 'js authoring → assets/js'],
    ['src/scripts/theme-utils.js', 'src/assets/js/theme-utils.js', 'js authoring → assets/js'],
    ['src/scripts/work-filters.js', 'src/assets/js/work-filters.js', 'js authoring → assets/js'],
    ['src/assets/og-ai-safety.jpg', 'src/assets/images/og/og-ai-safety.jpg', 'group OG images'],
    ['src/assets/static/logo.png', 'src/assets/images/logo.png', 'collapse static/ into images/'],
];

async function buildMoves() {
    for (const [from, to, note] of candidates) {
        const absFrom = path.join(cwd, from);
        if (await exists(absFrom)) MOVES.push({ from, to, note });
    }

    // Resolve index/list duplication under pages/work/
    const workTarget = 'src/pages/work/index.njk';
    const folderIdx = MOVES.find(m => m.from === 'src/work/index.njk' && m.to === workTarget);
    const topLevel = MOVES.find(m => m.from === 'src/work.njk' && m.to === workTarget);
    if (folderIdx && topLevel) {
        folderIdx.to = 'src/pages/work/list.njk';
        folderIdx.note = 'work paginated list';
    }

    // In-plan duplicate destinations
    const mapTo = new Map();
    for (const m of MOVES) {
        const arr = mapTo.get(m.to) || [];
        arr.push(m);
        mapTo.set(m.to, arr);
    }
    for (const [to, arr] of mapTo.entries()) {
        if (arr.length > 1) CONFLICTS.push({ what: to, why: `multiple sources → ${arr.map(x => x.from).join(', ')}` });
    }

    // On-disk destination collisions
    for (const m of MOVES) {
        const absTo = path.join(cwd, m.to);
        if (await exists(absTo)) CONFLICTS.push({ what: m.to, why: 'destination exists on disk' });
    }
}

async function applyMoves() {
    const conflictedTargets = new Set(CONFLICTS.map(c => c.what));
    for (const m of MOVES) {
        if (conflictedTargets.has(m.to)) continue;
        const absFrom = path.join(cwd, m.from);
        const absTo = path.join(cwd, m.to);
        if (!(await exists(absFrom))) continue;
        if (DRY) continue;
        await ensureDir(path.dirname(absTo));
        await fsp.rename(absFrom, absTo);
    }
}

const TEXT_EXTS = new Set(['.njk', '.md', '.11ty.js', '.js', '.json', '.css', '.yml', '.yaml']);

function replaceCount(str, re, replacement, counterKey) {
    let count = 0;
    const out = str.replace(re, (...args) => {
        count++;
        return (typeof replacement === 'function') ? replacement(...args) : replacement;
    });
    COUNTS[counterKey] += count;
    return [out, count];
}

async function scanAndRewrite() {
    // Use fast-glob to get all candidate text files (excluding archives/**)
    const files = await fg('src/**/*', {
        cwd,
        dot: true,
        onlyFiles: true,
        followSymbolicLinks: true,
        ignore: ['src/archives/**']
    });

    for (const pRel of files) {
        const p = path.join(cwd, pRel);
        const ext = path.extname(p);
        if (!TEXT_EXTS.has(ext)) continue;

        let txt = await fsp.readFile(p, 'utf8');
        let changed = false, out, n;

        // Front matter layout: accept both quoted/unquoted & CRLF
        [out, n] = replaceCount(
            txt,
            /(^|\r?\n)\s*layout\s*:\s*(['"])layout\.njk\2(\s*($|\r?\n))/g,
            (m, a, q, z) => `${a}layout: ${q}layouts/base.njk${q}${z}`,
            'rewrites_frontmatter_layout'
        ); if (n) { txt = out; changed = true; }

        [out, n] = replaceCount(
            txt,
            /(^|\r?\n)\s*layout\s*:\s*layout\.njk(\s*($|\r?\n))/g,
            (m, a, z) => `${a}layout: layouts/base.njk${z}`,
            'rewrites_frontmatter_layout'
        ); if (n) { txt = out; changed = true; }

        // Nunjucks extends/include path tweaks (outside archives)
        [out, n] = replaceCount(
            txt,
            /(\{%\s*(?:include|from)\s+["'])archive-nav\.njk(["'])/g,
            `$1components/archive-nav.njk$2`,
            'rewrites_includes_extends'
        ); if (n) { txt = out; changed = true; }

        [out, n] = replaceCount(
            txt,
            /(\{%\s*(?:include|from)\s+["'])layouts\/embed\.njk(["'])/g,
            `$1components/embed.njk$2`,
            'rewrites_includes_extends'
        ); if (n) { txt = out; changed = true; }

        [out, n] = replaceCount(
            txt,
            /(\{%\s*extends\s+["'])layout\.njk(["'])/g,
            `$1layouts/base.njk$2`,
            'rewrites_includes_extends'
        ); if (n) { txt = out; changed = true; }

        // Asset path nudges
        // og-ai-safety.jpg → assets/images/og/og-ai-safety.jpg (handles optional leading slash)
        [out, n] = replaceCount(
            txt,
            /(^|[^A-Za-z0-9_\/])\/?assets\/og-ai-safety\.jpg/g,
            (m, pre) => `${pre}/assets/images/og/og-ai-safety.jpg`,
            'rewrites_assets'
        ); if (n) { txt = out; changed = true; }

        // logo.png under assets/static → assets/images/logo.png (catch leading “/” too)
        [out, n] = replaceCount(
            txt,
            /(^|[^A-Za-z0-9_\/])\/?assets\/static\/logo\.png/g,
            (m, pre) => `${pre}/assets/images/logo.png`,
            'rewrites_assets'
        ); if (n) { txt = out; changed = true; }

        // Only internal-src references: src/scripts/ → src/assets/js/
        [out, n] = replaceCount(
            txt,
            /src\/scripts\//g,
            'src/assets/js/',
            'rewrites_srcscripts'
        ); if (n) { txt = out; changed = true; }

        if (changed) {
            TOUCHED.add(pRel);
            if (DO_IT) await fsp.writeFile(p, txt, 'utf8');
        }
    }
}

function h(title, n) {
    return `${chalk.bold(`# ${title}`)} ${chalk.dim(`(${n})`)}`;
}

function printReport() {
    console.log(`${chalk.bold('DRY:')} ${DRY ? chalk.yellow('yes') : chalk.green('no')}\n`);

    console.log(h('MOVES', MOVES.length));
    for (const m of MOVES) console.log(ppMove(m));
    console.log('');

    console.log(h('CONFLICTS', CONFLICTS.length));
    if (CONFLICTS.length === 0) console.log('(none)');
    else for (const c of CONFLICTS) console.log(`- ${c.what}  (${c.why})`);
    console.log('');

    const totalRewrites =
        COUNTS.rewrites_frontmatter_layout +
        COUNTS.rewrites_includes_extends +
        COUNTS.rewrites_assets +
        COUNTS.rewrites_srcscripts;

    console.log(`${chalk.bold(`# REWRITES`)} ${chalk.dim(`(${totalRewrites})`)}`);
    console.log(`- frontmatter:layout: ${COUNTS.rewrites_frontmatter_layout} change(s)`);
    console.log(`- includes/extends: ${COUNTS.rewrites_includes_extends} change(s)`);
    console.log(`- assets: ${COUNTS.rewrites_assets} change(s)`);
    console.log(`- src-scripts: ${COUNTS.rewrites_srcscripts} change(s)`);
    console.log('');

    console.log(h('TOUCHED', TOUCHED.size));
    for (const f of Array.from(TOUCHED).sort()) console.log(`- ${f}`);
    console.log('');

    if (DRY) console.log(chalk.dim('NOTE: This was a dry run. Use --do-it to apply changes.'));
}

(async () => {
    await buildMoves();
    await scanAndRewrite();
    await applyMoves();
    printReport();
})();
