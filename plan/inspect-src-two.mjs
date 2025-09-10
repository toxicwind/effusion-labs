// scripts/site-refactor.mjs
// Master refactor for src/: moves, rewrites, and hygiene with --dry (default) or --do-it.
//
// What it does (under src/ only):
// - Rename _includes/base.njk -> _includes/layouts/base.njk
// - Move route endpoints into src/pages/** (index, 404, map, feed, consulting,
//   concept-map.json, resume/{index,card}, work/* incl .11ty.js, plus top-level work.njk)
// - Move misfiled includes: _includes/layouts/embed.njk -> _includes/components/embed.njk
//                           _includes/archive-nav.njk   -> _includes/components/archive-nav.njk
// - Consolidate author JS:  src/assets/js/* -> src/assets/js/*
// - Nudge images:           src/assets/og-ai-safety.jpg -> src/assets/images/og/og-ai-safety.jpg
//                           src/assets/static/logo.png  -> src/assets/images/logo.png
// - Rewrites inside src/** files only (skip src/archives/**):
//     * front matter layout: "base.njk"        -> "layouts/base.njk"
//     * nunjucks extends:    {% extends "base.njk" %} -> "layouts/base.njk"
//     * nunjucks includes:   archive-nav.njk     -> components/archive-nav.njk
//                            layouts/embed.njk   -> components/embed.njk
//     * JS/11ty data:        layout: 'base.njk' -> 'layouts/base.njk'
//     * src/assets/js/ paths   -> src/assets/js/   (does NOT rewrite '/scripts/' web paths)
//     * specific assets      -> /assets/images/* as listed above
//
// Excludes: src/archives/** from content rewrites. Never touches repo folders outside src/.
//
// Usage:
//   node scripts/site-refactor.mjs --dry         (plan only; default)
//   node scripts/site-refactor.mjs --do-it       (perform moves + rewrites; requires clean git)
//   node scripts/site-refactor.mjs --check       (CI style: exit 2 if there would be changes)
//   [--verbose] for more chatter

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const DRY = !process.argv.includes('--do-it');
const CHECK_ONLY = process.argv.includes('--check');
const VERBOSE = process.argv.includes('--verbose');

const rel = p => path.relative(ROOT, p);
const inSrc = p => p.startsWith(SRC + path.sep);
const exists = async p => !!(await fsp.stat(p).catch(() => null));
const ensureDir = async d => { if (!(await exists(d))) await fsp.mkdir(d, { recursive: true }); };
const readText = p => fsp.readFile(p, 'utf8');
const writeText = (p, s) => fsp.writeFile(p, s, 'utf8');

function gitClean() {
    const r = spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
    return r.status === 0 && r.stdout.trim() === '';
}

// --- simple walker (no deps), src/ only ---
async function* walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            // skip archives subtree for rewrites; moves may still plan within src/work etc.
            yield* walk(p);
        } else {
            yield p;
        }
    }
}
const textExt = new Set(['.njk', '.md', '.11ty.js', '.js', '.json', '.css', '.yml', '.yaml']);

// --- plan containers ---
const MOVES = [];
const SKIPPED = [];
const REWRITES = [];
const TOUCH = new Set();
const CONFLICTS = [];

// helpers
function planMove(fromAbs, toAbs, note = '') {
    if (!inSrc(fromAbs) || !inSrc(toAbs)) return; // guard: src only
    MOVES.push({ from: rel(fromAbs), to: rel(toAbs), note });
}
function planRewrite(fileAbs, kind, detail) {
    REWRITES.push({ file: rel(fileAbs), kind, detail });
    TOUCH.add(rel(fileAbs));
}
function noteConflict(what, why) { CONFLICTS.push({ what, why }); }
function noteSkip(what, why) { SKIPPED.push({ what, why }); }

function replaceFrontMatterLayout(text) {
    // Only replace "base.njk" string values; leave false/null untouched.
    // Handle YAML front matter at top delimited by --- ... ---.
    if (!text.startsWith('---')) return { text, changed: false };
    const end = text.indexOf('\n---', 3);
    if (end === -1) return { text, changed: false };
    const fm = text.slice(0, end + 4);
    const body = text.slice(end + 4);
    const before = fm;
    // Match: layout: 'base.njk' or "base.njk"
    const fmNew = fm.replace(
        /(^|\n)\s*layout\s*:\s*(['"])layout\.njk\2\s*($|\n)/,
        (m, a, q, z) => `${a}layout: ${q}layouts/base.njk${q}${z}`
    );
    if (fmNew === before) return { text, changed: false };
    return { text: fmNew + body, changed: true };
}

function multiReplace(str, rules) {
    let changed = false;
    let out = str;
    for (const { re, to } of rules) {
        const prev = out;
        out = out.replace(re, to);
        if (out !== prev) changed = true;
    }
    return { changed, out };
}

function shouldRewrite(fileAbs) {
    if (!inSrc(fileAbs)) return false;
    if (fileAbs.includes(`${path.sep}archives${path.sep}`)) return false; // skip archives/**
    const ext = path.extname(fileAbs).toLowerCase();
    return textExt.has(ext);
}

// compute planned moves
async function computeMoves() {
    // Base layout normalization
    const LAYOUT_SRC = path.join(SRC, '_includes', 'base.njk');
    const LAYOUT_DST = path.join(SRC, '_includes', 'layouts', 'base.njk');
    if (await exists(LAYOUT_SRC)) planMove(LAYOUT_SRC, LAYOUT_DST, 'normalize base layout');

    // Endpoints → pages
    const endpoints = [
        ['404.njk', 'pages/404.njk'],
        ['index.njk', 'pages/index.njk'],
        ['map.njk', 'pages/map.njk'],
        ['feed.njk', 'pages/feed.njk'],
        ['consulting.njk', 'pages/consulting.njk'],
        ['concept-map.json.njk', 'pages/concept-map.json.njk'],
    ];
    for (const [fromRel, toRel] of endpoints) {
        const fromAbs = path.join(SRC, fromRel);
        if (await exists(fromAbs)) planMove(fromAbs, path.join(SRC, toRel), 'endpoint → pages/');
    }

    // Resume pages (layout:false) from content → pages/resume
    const RESUME_SRC = path.join(SRC, 'content', 'resume.njk');
    const RESUME_CARD_SRC = path.join(SRC, 'content', 'resume-card.njk');
    if (await exists(RESUME_SRC)) planMove(RESUME_SRC, path.join(SRC, 'pages', 'resume', 'index.njk'), 'resume endpoint');
    if (await exists(RESUME_CARD_SRC)) planMove(RESUME_CARD_SRC, path.join(SRC, 'pages', 'resume', 'card.njk'), 'resume card endpoint');

    // work endpoints → pages/work
    const WORK_DIR = path.join(SRC, 'work');
    if (await exists(WORK_DIR)) {
        const entries = await fsp.readdir(WORK_DIR);
        for (const name of entries) {
            const fromAbs = path.join(WORK_DIR, name);
            const toAbs = path.join(SRC, 'pages', 'work', name);
            planMove(fromAbs, toAbs, 'work endpoint');
        }
    }
    // top-level work.njk → pages/work/work-list.njk (avoid clobbering existing index)
    const WORK_TOP = path.join(SRC, 'work.njk');
    if (await exists(WORK_TOP)) {
        planMove(
            WORK_TOP,
            path.join(SRC, 'pages', 'work', 'work-list.njk'),
            'keep directory index; split alt view as /work/work-list/'
        );
    }

    // misfiled includes
    const EMBED_SRC = path.join(SRC, '_includes', 'layouts', 'embed.njk');
    if (await exists(EMBED_SRC)) planMove(EMBED_SRC, path.join(SRC, '_includes', 'components', 'embed.njk'), 'component, not layout');
    const ARCHIVE_NAV_SRC = path.join(SRC, '_includes', 'archive-nav.njk');
    if (await exists(ARCHIVE_NAV_SRC)) planMove(ARCHIVE_NAV_SRC, path.join(SRC, '_includes', 'components', 'archive-nav.njk'), 'component placement');

    // consolidate src/scripts → src/assets/js
    const SRC_SCRIPTS = path.join(SRC, 'scripts');
    if (await exists(SRC_SCRIPTS)) {
        const files = await fsp.readdir(SRC_SCRIPTS);
        for (const f of files) {
            const fromAbs = path.join(SRC_SCRIPTS, f);
            if ((await fsp.stat(fromAbs)).isFile()) {
                planMove(fromAbs, path.join(SRC, 'assets', 'js', f), 'js authoring → assets/js');
            }
        }
    }

    // images nudges
    const OG_IMG = path.join(SRC, 'assets', 'og-ai-safety.jpg');
    if (await exists(OG_IMG)) planMove(OG_IMG, path.join(SRC, 'assets', 'images', 'og', 'og-ai-safety.jpg'), 'group OG images');
    const LOGO = path.join(SRC, 'assets', 'static', 'logo.png');
    if (await exists(LOGO)) planMove(LOGO, path.join(SRC, 'assets', 'images', 'logo.png'), 'collapse static/ into images/');
}

// detect conflicts (dest already exists or multiple sources → same dest)
async function detectConflicts() {
    // FS destination exists
    for (const m of MOVES) {
        const toAbs = path.join(ROOT, m.to);
        if (await exists(toAbs)) noteConflict(m.to, 'destination already exists');
    }
    // Multiple sources to same dest (in-memory)
    const byDest = new Map();
    for (const m of MOVES) {
        const list = byDest.get(m.to) || [];
        list.push(m.from);
        byDest.set(m.to, list);
    }
    for (const [to, froms] of byDest) {
        if (froms.length > 1) {
            noteConflict(to, `multiple sources → ${froms.join(', ')}`);
        }
    }
}

async function applyMoves() {
    const conflictDest = new Set(CONFLICTS.map(c => c.what));
    for (const m of MOVES) {
        const fromAbs = path.join(ROOT, m.from);
        const toAbs = path.join(ROOT, m.to);
        if (!(await exists(fromAbs))) { noteSkip(m.from, 'missing source'); continue; }
        if (conflictDest.has(m.to)) continue; // skip conflicted target
        if (!DRY) {
            await ensureDir(path.dirname(toAbs));
            await fsp.rename(fromAbs, toAbs);
            if (VERBOSE) console.log(`moved: ${m.from} -> ${m.to}`);
        }
    }
}

async function scanAndRewrite() {
    for await (const p of walk(SRC)) {
        if (!shouldRewrite(p)) continue;
        let txt = await readText(p);
        const orig = txt;
        let changed = false;

        // 1) front matter layout ref
        if (txt.startsWith('---')) {
            const fmRes = replaceFrontMatterLayout(txt);
            if (fmRes.changed) {
                txt = fmRes.text;
                changed = true;
                planRewrite(p, 'frontmatter:layout', `"base.njk" → "layouts/base.njk"`);
            }
        }

        // 2) nunjucks include/extends fixes
        const njkRules = [
            { re: /(\{%\s*(?:include|from)\s+["'])archive-nav\.njk(["'])/g, to: `$1components/archive-nav.njk$2` },
            { re: /(\{%\s*(?:include|extends|from)\s+["'])layouts\/embed\.njk(["'])/g, to: `$1components/embed.njk$2` },
            { re: /(\{%\s*extends\s+["'])layout\.njk(["'])/g, to: `$1layouts/base.njk$2` },
        ];
        const inc = multiReplace(txt, njkRules);
        if (inc.changed) {
            txt = inc.out;
            changed = true;
            planRewrite(p, 'nunjucks', 'archive-nav/embed path + base layout extends');
        }

        // 3) JS data.layout in .11ty.js / .js (best-effort)
        if (p.endsWith('.11ty.js') || p.endsWith('.js')) {
            const j = multiReplace(txt, [
                { re: /(layout\s*:\s*['"])layout\.njk(['"])/g, to: `$1layouts/base.njk$2` },
            ]);
            if (j.changed) {
                txt = j.out;
                changed = true;
                planRewrite(p, 'js:data.layout', `layout: 'base.njk' → 'layouts/base.njk'`);
            }
        }

        // 4) src-only script import path (do NOT touch '/scripts/' web root)
        const jsRules = [
            { re: /(["'`])src\/scripts\//g, to: `$1src/assets/js/` },
        ];
        const jsr = multiReplace(txt, jsRules);
        if (jsr.changed) {
            txt = jsr.out;
            changed = true;
            planRewrite(p, 'paths', 'src/assets/js/ → src/assets/js/');
        }

        // 5) specific asset path nudges (root-absolute & data)
        const assetRules = [
            { re: /\/assets\/og-ai-safety\.jpg\b/g, to: `/assets/images/og/og-ai-safety.jpg` },
            { re: /(?<!:)assets\/static\/logo\.png\b/g, to: `assets/images/logo.png` },   // relative
            { re: /\/assets\/static\/logo\.png\b/g, to: `/assets/images/logo.png` },      // root-abs
        ];
        const ar = multiReplace(txt, assetRules);
        if (ar.changed) {
            txt = ar.out;
            changed = true;
            planRewrite(p, 'assets', 'update og/logo paths under /assets/images/*');
        }

        if (changed && !DRY) {
            await writeText(p, txt);
            if (VERBOSE) console.log(`rewrote: ${rel(p)}`);
        }
    }
}

function printReport(foundCount) {
    const touched = Array.from(TOUCH).sort();
    const moves = MOVES.slice();
    const conflicts = CONFLICTS.slice();
    const skipped = SKIPPED.slice();
    const rewrites = REWRITES.slice();

    console.log(`DRY RUN  — site-refactor`);
    console.log(`root: ${ROOT}\n`);
    console.log('› Summary\n');
    console.log(`  Found files:     ${foundCount}`);
    console.log(`  Moves planned:   ${moves.length}`);
    console.log(`  Rewrites planned:${rewrites.length}`);
    console.log(`  Touched files:   ${touched.length}`);
    console.log(`  Conflicts:       ${conflicts.length}\n`);

    console.log('› Moves\n');
    if (moves.length) {
        for (const m of moves) {
            const note = m.note ? `  (${m.note})` : '';
            console.log(`  ${m.from}  →  ${m.to}${note}`);
        }
    } else { console.log('  (none)'); }
    console.log('\n› Conflicts\n');
    if (conflicts.length) {
        for (const c of conflicts) console.log(`  ${c.what}  (${c.why})`);
    } else { console.log('  (none)'); }

    // Rewrites by kind
    const byKind = rewrites.reduce((acc, r) => ((acc[r.kind] ||= 0, acc[r.kind]++), acc), {});
    console.log('\n› Rewrites (by kind)\n');
    if (rewrites.length) {
        for (const [k, n] of Object.entries(byKind)) console.log(`  ${k}: ${n}`);
    } else { console.log('  (none)'); }

    // Touched files (only list if any)
    if (touched.length) {
        console.log('\n› Touched files\n');
        for (const t of touched) console.log(`  ${t}`);
    }
    console.log('');
}

(async function main() {
    if (!(await exists(SRC))) {
        console.error(`fatal: missing src/ at ${rel(SRC)}`);
        process.exit(1);
    }
    if (!DRY && !gitClean()) {
        console.error('Refusing to run with --do-it: working tree is dirty. Commit/stash first.');
        process.exit(1);
    }

    // Count files once, for report cosmetics
    let total = 0;
    for await (const _ of walk(SRC)) total++;

    await computeMoves();
    await detectConflicts();
    await applyMoves();
    await scanAndRewrite();

    printReport(total);

    if (CHECK_ONLY) {
        const planned = MOVES.length + REWRITES.length;
        process.exit(planned > 0 ? 2 : 0);
    }

    if (DRY) {
        console.log('NOTE: This was a dry run. Use --do-it to apply changes.');
        console.log('Reminder: ensure Eleventy copies "src/assets" → "assets" (passthrough) after this refactor.');
    } else {
        console.log('APPLIED. Consider running: npx @11ty/eleventy && rg -n "layout\\.njk|layouts\\/embed\\.njk|archive-nav\\.njk|src\\/scripts\\/" src/');
    }
})().catch(err => {
    console.error(err);
    process.exit(1);
});
