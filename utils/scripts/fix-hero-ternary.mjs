#!/usr/bin/env node
// Scan *.njk (and optionally *.md/*.html) for:
// 1) JS-style ternaries inside {{ … }}  -> rewrite to {% if %}…{% endif %}
// 2) JS comments inside {{ … }} or {% … %} -> strip
//
// Idempotent & creates .bak backups.
//
// Usage:
//   node utils/dev/fix-nunjucks-js-syntax.mjs [rootDir] [--ext=.njk,.md,.html]
//
// Example:
//   node utils/dev/fix-nunjucks-js-syntax.mjs src --ext=.njk
//
// Notes:
// - We only rewrite ternaries inside {{ … }}. We *do not* touch {% … %} logic.
// - We remove JS comments from both {{ … }} and {% … %} blocks.

import { promises as fsp } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.argv[2] || 'src';
const extArg = process.argv.find(a => a.startsWith('--ext=')) || '';
const exts = (extArg.replace('--ext=', '') || '.njk,.md,.html')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

const MM = Object.freeze({
    VAR_OPEN: '{{',
    VAR_CLOSE: '}}',
    TAG_OPEN: '{%',
    TAG_CLOSE: '%}',
});

function isWantedExt(file) {
    const e = path.extname(file).toLowerCase();
    return exts.includes(e);
}

async function walk(dir) {
    const out = [];
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            out.push(...(await walk(p)));
        } else if (ent.isFile() && isWantedExt(p)) {
            out.push(p);
        }
    }
    return out;
}

// --- Low-level helpers -------------------------------------------------------

function stripJsCommentsInside(code) {
    // Remove /* … */ safely
    let s = code.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove //… (but avoid http://, https://, ://)
    // Heuristic: // preceded by start-of-line or whitespace (not ":")
    s = s.replace(/(^|[^\S\r\n])\/\/[^\n\r]*/g, (m, lead) => lead || '');
    return s;
}

function splitJsTernary(expr) {
    // Return {cond, yes, no} if we find a top-level ? … : … pair, ignoring quotes and brackets.
    // Otherwise return null.
    let depthParen = 0, depthBrack = 0, depthBrace = 0;
    let inStr = false, strCh = '';
    let prev = '';
    let qIdx = -1, cIdx = -1;

    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (inStr) {
            if (ch === strCh && prev !== '\\') { inStr = false; strCh = ''; }
            prev = ch; continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; prev = ch; continue; }

        // track parens/brackets/braces
        if (ch === '(') depthParen++;
        else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
        else if (ch === '[') depthBrack++;
        else if (ch === ']') depthBrack = Math.max(0, depthBrack - 1);
        else if (ch === '{') depthBrace++;
        else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);

        const topLevel = depthParen === 0 && depthBrack === 0 && depthBrace === 0;

        if (topLevel && qIdx === -1 && ch === '?') qIdx = i;
        else if (topLevel && qIdx !== -1 && ch === ':') { cIdx = i; break; }

        prev = ch;
    }

    if (qIdx === -1 || cIdx === -1) return null;

    const cond = expr.slice(0, qIdx).trim();
    const yes = expr.slice(qIdx + 1, cIdx).trim();
    const no = expr.slice(cIdx + 1).trim();
    if (!cond || !yes || !no) return null;
    return { cond, yes, no };
}

function rewriteVarBlock(block) {
    // block is like "{{ ... }}". Return rewritten string (possibly unchanged).
    let inner = block.slice(2, -2); // remove {{ … }}
    const original = inner;

    // 1) remove JS comments
    inner = stripJsCommentsInside(inner);

    // 2) skip if already Jinja-style ternary (a if cond else b)
    if (/\sif\s.+\selse\s/.test(inner)) {
        return `{{${inner}}}`;
    }

    // 3) detect and rewrite JS-style ternary
    if (inner.includes('?') && inner.includes(':')) {
        const tri = splitJsTernary(inner);
        if (tri) {
            return `{% if ${tri.cond} %}{{ ${tri.yes} }}{% else %}{{ ${tri.no} }}{% endif %}`;
        }
    }

    // no changes except comment strip
    if (inner !== original) return `{{${inner}}}`;
    return block;
}

function rewriteTagBlock(block) {
    // block like "{% ... %}" — we only strip JS comments here.
    let inner = block.slice(2, -2);
    const stripped = stripJsCommentsInside(inner);
    return stripped === inner ? block : `{%${stripped}%}`;
}

function transformFileContent(src) {
    let changed = false;
    let out = src;

    // Process {{ … }} first
    out = out.replace(/\{\{[\s\S]*?\}\}/g, (m) => {
        const r = rewriteVarBlock(m);
        if (r !== m) changed = true;
        return r;
    });

    // Then process {% … %}
    out = out.replace(/\{%\s*[\s\S]*?\s*%\}/g, (m) => {
        const r = rewriteTagBlock(m);
        if (r !== m) changed = true;
        return r;
    });

    return { out, changed };
}

// --- Main --------------------------------------------------------------------

async function main() {
    const files = await walk(root);
    if (!files.length) {
        console.log(`• No files found under ${root} with extensions ${exts.join(', ')}`);
        return;
    }
    let touched = 0;

    for (const file of files) {
        let src;
        try {
            src = await fsp.readFile(file, 'utf8');
        } catch (e) {
            console.warn(`! Skipping unreadable: ${file} (${e.message})`);
            continue;
        }

        const { out, changed } = transformFileContent(src);
        if (!changed) continue;

        try {
            if (!fs.existsSync(`${file}.bak`)) {
                await fsp.copyFile(file, `${file}.bak`);
            }
            await fsp.writeFile(file, out, 'utf8');
            touched++;
            console.log(`✓ Fixed ${path.relative(process.cwd(), file)} (backup: ${path.basename(file)}.bak)`);
        } catch (e) {
            console.error(`✗ Failed writing ${file}: ${e.message}`);
        }
    }

    if (touched === 0) {
        console.log('• No JS-style ternaries or JS comments found (or already fixed).');
    } else {
        console.log(`\n✔ Done. Updated ${touched} file(s).`);
    }

    // Soft warnings for patterns we can’t auto-fix well
    console.log('\nHeads-up checks:');
    console.log('  - Avoid JS constructs like `new Set()` or `.add()` in Nunjucks; use arrays + filters (e.g. compactUnique).');
    console.log('  - Avoid inline /* … */ or // comments inside template expressions; prefer {# … #}.');
}

main().catch((e) => {
    console.error('✗ Unexpected error:', e);
    process.exit(1);
});
