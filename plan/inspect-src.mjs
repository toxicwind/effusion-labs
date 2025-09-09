#!/usr/bin/env node
/**
 * Refactor src/ into a future-proof 11ty layout.
 * - Writes a plan even on --dry
 * - Auto-merges directory conflicts when --apply
 * - Rewrites layout refs and asset/script paths
 * - Forces layout:false on resume/* and consulting
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CWD = process.cwd();
const SRC = path.join(CWD, 'src');
const OUTDIR = path.join(CWD, 'var/refactor');
const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply') || args.has('-y');
const DRY = !APPLY;

// ---------- helpers ----------
const exists = p => fs.existsSync(p);
const isDir = p => exists(p) && fs.statSync(p).isDirectory();
const isFile = p => exists(p) && fs.statSync(p).isFile();
const ensureDir = p => fs.mkdirSync(p, { recursive: true });
const rel = p => path.relative(CWD, p) || '.';
const sha1 = buf => crypto.createHash('sha1').update(buf).digest('hex');
const readText = p => fs.readFileSync(p, 'utf8');
const writeText = (p, s) => { ensureDir(path.dirname(p)); fs.writeFileSync(p, s); };

// recursive walk
function* walk(dir) {
    for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, dirent.name);
        if (dirent.isDirectory()) yield* walk(full);
        else yield full;
    }
}

// naive text-file check by ext
const TEXT_EXT = new Set(['.njk', '.md', '.11ty.js', '.js', '.json', '.css', '.svg', '.html']);
const isTextish = p => TEXT_EXT.has(path.extname(p));

// copy file if changed
async function copyFileSmart(src, dest, plan) {
    const srcBuf = await fsp.readFile(src);
    const srcHash = sha1(srcBuf);
    let doWrite = true;
    if (isFile(dest)) {
        const dstBuf = await fsp.readFile(dest);
        if (sha1(dstBuf) === srcHash) doWrite = false;
    }
    if (!DRY && doWrite) {
        ensureDir(path.dirname(dest));
        await fsp.writeFile(dest, srcBuf);
    }
    plan.touched.add(dest);
}

// move file (copy+remove src)
async function moveFileSmart(src, dest, plan) {
    await copyFileSmart(src, dest, plan);
    if (!DRY) await fsp.rm(src);
    plan.moves.push([rel(src), rel(dest)]);
}

// merge directories (source → dest, prefer source on conflicts)
async function mergeDirSmart(srcDir, destDir, plan) {
    for (const file of walk(srcDir)) {
        const relPath = path.relative(srcDir, file);
        const dest = path.join(destDir, relPath);
        await copyFileSmart(file, dest, plan);
    }
    if (!DRY) await fsp.rm(srcDir, { recursive: true, force: true });
    plan.merges.push([rel(srcDir), rel(destDir)]);
}

// front matter updater (very light: only layout)
function ensureLayoutFalse(filePath, plan) {
    if (!isFile(filePath)) return;
    let txt = readText(filePath);
    // add or update YAML front matter layout:false
    if (/^---\s*[\s\S]*?---/.test(txt)) {
        // has FM: replace layout: ... with false or insert it
        if (/^---[\s\S]*?\blayout\s*:\s*.*$/m.test(txt)) {
            txt = txt.replace(/^---([\s\S]*?)\blayout\s*:\s*.*$/m, (_m, head) => `---${head}layout: false`);
        } else {
            txt = txt.replace(/^---\s*\n/, `---\nlayout: false\n`);
        }
    } else {
        txt = `---\nlayout: false\n---\n` + txt;
    }
    if (!DRY) writeText(filePath, txt);
    plan.touched.add(filePath);
}

// bulk rewrite (paths + layout)
function rewriteInFile(filePath, plan) {
    if (!isFile(filePath) || !isTextish(filePath)) return;
    let before = readText(filePath);
    let after = before;

    // layout rename
    after = after.replace(/\blayout:\s*["']?layout\.njk["']?/g, 'layout: layouts/base.njk');

    // script path rewrites
    after = after.replace(/\/scripts\//g, '/assets/js/');
    after = after.replace(/src\/scripts\//g, 'src/assets/js/');

    // image path rewrites
    after = after.replace(/\/assets\/og-ai-safety\.jpg/g, '/assets/images/og/og-ai-safety.jpg');
    after = after.replace(/assets\/static\/logo\.png/g, 'assets/images/logo.png');

    if (after !== before) {
        if (!DRY) writeText(filePath, after);
        plan.touched.add(filePath);
    }
}

// ---------- plan definition ----------
const moves = [
    ['src/_includes/layout.njk', 'src/_includes/layouts/base.njk', 'normalize base layout'],
    ['src/404.njk', 'src/pages/404.njk', 'consolidate route pages'],
    ['src/index.njk', 'src/pages/index.njk', 'consolidate route pages'],
    ['src/map.njk', 'src/pages/map.njk', 'consolidate route pages'],
    ['src/feed.njk', 'src/pages/feed.njk', 'consolidate route pages'],
    ['src/consulting.njk', 'src/pages/consulting.njk', 'consolidate route pages'],
    ['src/content/resume.njk', 'src/pages/resume/index.njk', 'resume → pages/resume (layout:false)'],
    ['src/content/resume-card.njk', 'src/pages/resume/card.njk', 'resume card → pages/resume (layout:false)'],
    ['src/redirects.11ty.js', 'src/routes/redirects.11ty.js', 'route script → src/routes/'],
    ['src/assets/og-ai-safety.jpg', 'src/assets/images/og/og-ai-safety.jpg', 'group OG images'],
    ['src/assets/static/logo.png', 'src/assets/images/logo.png', 'collapse static/ into images/'],
];

// dir merges (dest already exists)
const merges = [
    ['src/archives', 'src/content/archives'],
    ['src/work', 'src/content/work'],
    ['src/scripts', 'src/assets/js'],
];

// files to force layout:false after refactor
const enforceNoLayoutTargets = [
    // before move (if they haven’t been moved yet)
    'src/content/resume.njk',
    'src/content/resume-card.njk',
    'src/consulting.njk',
    // after move
    'src/pages/resume/index.njk',
    'src/pages/resume/card.njk',
    'src/pages/consulting.njk',
];

// ---------- execution ----------
(async () => {
    const plan = {
        dry: DRY,
        moves: [],
        merges: [],
        rewrites: [],
        touched: new Set(),
        skipped: [],
        notes: [],
    };

    // sanity
    if (!isDir(SRC)) {
        console.error(`src/ not found at: ${rel(SRC)}`);
        process.exit(2);
    }

    // 1) perform file moves (non-merge)
    for (const [fromRel, toRel] of moves) {
        const from = path.join(CWD, fromRel);
        const to = path.join(CWD, toRel);
        if (!exists(from)) { plan.skipped.push([fromRel, 'missing']); continue; }
        ensureDir(path.dirname(to));
        await moveFileSmart(from, to, plan);
    }

    // 2) auto-merge the conflicting directories
    for (const [fromRel, toRel] of merges) {
        const from = path.join(CWD, fromRel);
        const to = path.join(CWD, toRel);
        if (!exists(from)) { plan.skipped.push([fromRel, 'missing']); continue; }
        ensureDir(to);
        await mergeDirSmart(from, to, plan);
    }

    // 3) global rewrites (layouts + paths)
    for (const file of walk(SRC)) {
        rewriteInFile(file, plan);
    }

    // 4) enforce layout:false where required
    for (const p of enforceNoLayoutTargets) {
        const abs = path.join(CWD, p);
        if (exists(abs)) ensureLayoutFalse(abs, plan);
    }

    // 5) compile report (always write, even in dry)
    ensureDir(OUTDIR);

    const txt = [
        `DRY: ${DRY ? 'yes' : 'no'}`,
        ``,
        `# MOVES (${plan.moves.length})`,
        ...plan.moves.map(([a, b]) => `- ${a}  ->  ${b}`),
        ``,
        `# MERGES (${plan.merges.length})`,
        ...plan.merges.map(([a, b]) => `- ${a}  ⇒  ${b}  (merged dir)`),
        ``,
        `# SKIPPED (${plan.skipped.length})`,
        ...plan.skipped.map(([a, why]) => `- ${a}  (${why})`),
        ``,
        `# TOUCHED (${plan.touched.size})`,
        ...Array.from(plan.touched).sort().map(p => `- ${rel(p)}`),
        ``,
        `# REWRITES`,
        `- layout.njk → layouts/base.njk`,
        `- /scripts/ → /assets/js/`,
        `- src/scripts/ → src/assets/js/`,
        `- /assets/og-ai-safety.jpg → /assets/images/og/og-ai-safety.jpg`,
        `- assets/static/logo.png → assets/images/logo.png`,
        ``,
        `# NOTES`,
        `- consulting and resume/* forced to layout:false`,
    ].join('\n');

    const json = {
        dry: DRY,
        moves: plan.moves,
        merges: plan.merges,
        skipped: plan.skipped,
        touched: Array.from(plan.touched).map(p => rel(p)),
        rewrites: [
            ['/scripts/', '/assets/js/'],
            ['src/scripts/', 'src/assets/js/'],
            ['/assets/og-ai-safety.jpg', '/assets/images/og/og-ai-safety.jpg'],
            ['assets/static/logo.png', 'assets/images/logo.png'],
            ['layout: layout.njk', 'layout: layouts/base.njk'],
        ],
        notes: ['consulting and resume/* forced to layout:false'],
    };

    writeText(path.join(OUTDIR, 'src-refactor-plan.txt'), txt);
    writeText(path.join(OUTDIR, 'src-refactor-plan.json'), JSON.stringify(json, null, 2));

    // 6) console summary
    console.log(txt);
})();
