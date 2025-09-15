#!/usr/bin/env node
// Node 24+ ESM — robust repo-wide audit for legacy asset references.
// Prints path:line:col + short hint. Safe on dirs/symlinks/unreadables.

import fs, { promises as fsp } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = process.cwd()
const REPORT = resolve(ROOT, 'artifacts/legacy-assets-scan.txt')

// ---- scope ------------------------------------------------------------------
const IGNORE_DIRS = new Set([
    'node_modules', '.git', '_site', '.11ty-vite', '.cache',
    'artifacts', 'var', 'logs', 'coverage'
])
const MAX_FILE_BYTES = 2 * 1024 * 1024 // skip >2MB

const TEXT_EXTS = new Set([
    '.njk', '.html', '.md', '.markdown', '.txt',
    '.js', '.mjs', '.cjs', '.ts',
    '.json', '.yaml', '.yml', '.css',
    '.svg', '.xml'
])

// ---- patterns to flag -------------------------------------------------------
const PATS = [
    { name: '/assets/js/', rx: /(^|["'(])\/?assets\/js\//g, hint: '→ module: /src/assets/js/…; classic: /js/… (public)' },
    { name: '/assets/css/', rx: /(^|["'(])\/?assets\/css\//g, hint: '→ /src/assets/css/…' },
    { name: '/assets/images/', rx: /(^|["'(])\/?assets\/images\//g, hint: '→ /images/… (public)' },
    { name: '/assets/media/', rx: /(^|["'(])\/?assets\/media\//g, hint: '→ /media/… (public)' },
    { name: '/assets/fonts/', rx: /(^|["'(])\/?assets\/fonts\//g, hint: '→ /fonts/… (public)' },
    { name: '/assets/icons/', rx: /(^|["'(])\/?assets\/icons\//g, hint: '→ root favicons + /icons/… (public)' },
    { name: '/assets/static/', rx: /(^|["'(])\/?assets\/static\//g, hint: '→ /… (root, public)' },
    { name: 'favicon-96x96.png', rx: /favicon-96x96\.png/g, hint: '→ use /favicon.ico or /favicon.svg; app icons under /icons' },
    { name: 'web-app-manifest-192x192', rx: /web-app-manifest-192x192\.png/g, hint: '→ /icons/icon-192.png' },
    { name: 'web-app-manifest-512x512', rx: /web-app-manifest-512x512\.png/g, hint: '→ /icons/icon-512.png' },
    { name: 'addPassthroughCopy src/assets', rx: /addPassthroughCopy\s*\([\s\S]*?src\/assets/gi, hint: '→ remove (Vite handles public/)' },
    { name: 'addWatchTarget src/assets', rx: /addWatchTarget\s*\(\s*['"]src\/assets['"]/gi, hint: '→ remove' },
]
const SCRIPT_TAG = /<script\b[^>]*\bsrc=(["'])[^"']*\/assets\/js\/[^"']+\1[^>]*>/gi

// ---- helpers ----------------------------------------------------------------
const rel = p => relative(ROOT, p).replace(/\\/g, '/')
const extOf = p => (p.match(/\.[^./\\]+$/)?.[0] ?? '').toLowerCase()
const isBinaryBuffer = buf => buf.includes(0)

async function listFiles(dir, out = []) {
    let ents
    try { ents = await fsp.readdir(dir, { withFileTypes: true }) } catch { return out }
    for (const e of ents) {
        const p = join(dir, e.name)
        if (e.isDirectory()) {
            if (!IGNORE_DIRS.has(e.name)) await listFiles(p, out)
        } else if (e.isFile()) {
            out.push(p)
        } else if (e.isSymbolicLink()) {
            // follow symlink only if target is a file
            try {
                const target = await fsp.stat(p)
                if (target.isFile()) out.push(p)
            } catch { /* ignore broken/perm denied symlink */ }
        }
    }
    return out
}

function* scanLines(text, rx) {
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const r = new RegExp(rx.source, rx.flags) // fresh per line
        let m
        while ((m = r.exec(line))) {
            yield { lineNo: i + 1, col: m.index + 1, match: m[0], line }
            if (m.index === r.lastIndex) r.lastIndex++
        }
    }
}

function truncate(line, max = 180) {
    if (line.length <= max) return line
    return line.slice(0, max - 1) + '…'
}

// ---- main -------------------------------------------------------------------
const findings = []
const summary = new Map()

async function auditFile(file) {
    let st
    try { st = await fsp.lstat(file) } catch { return }
    if (!st.isFile() && !(st.isSymbolicLink())) return

    // resolve symlink target type if needed
    if (st.isSymbolicLink()) {
        try {
            const tgt = await fsp.stat(file)
            if (!tgt.isFile()) return
            st = tgt
        } catch { return }
    }

    if (st.size > MAX_FILE_BYTES) return

    // quick binary & extension gate (for non-texty extensions)
    let buf
    try { buf = await fsp.readFile(file) }
    catch { return } // unreadable, skip silently
    const ext = extOf(file)
    if (!TEXT_EXTS.has(ext) && isBinaryBuffer(buf)) return

    const text = buf.toString('utf8')

    if (
        !/assets\//.test(text) &&
        !/addPass|addWatchTarget|favicon-96|web-app-manifest-(192|512)/i.test(text)
    ) return

    for (const pat of PATS) {
        for (const hit of scanLines(text, pat.rx)) {
            findings.push({
                file: rel(file),
                name: pat.name,
                hint: pat.hint,
                lineNo: hit.lineNo,
                col: hit.col,
                token: hit.match.replace(/\s+/g, ' ').trim(),
                line: truncate(hit.line.trim()),
            })
            summary.set(pat.name, (summary.get(pat.name) ?? 0) + 1)
        }
    }

    // bonus: classic script tags
    for (const hit of scanLines(text, SCRIPT_TAG)) {
        findings.push({
            file: rel(file),
            name: 'classic-script-tag',
            hint: '→ move to /public/js and reference /js/… (or convert to type="module")',
            lineNo: hit.lineNo,
            col: hit.col,
            token: '<script … src="/assets/js/…">',
            line: truncate(hit.line.trim()),
        })
        summary.set('classic-script-tag', (summary.get('classic-script-tag') ?? 0) + 1)
    }
}

async function main() {
    const files = await listFiles(ROOT)
    for (const f of files) {
        await auditFile(f)
    }

    let out = ''
    out += `LEGACY ASSETS SCAN • ${new Date().toISOString()}\n`
    out += `root: ${ROOT}\n`
    out += `files scanned: ${files.length}\n`

    out += `\n=== summary by pattern ===`
    const keys = Array.from(summary.keys()).sort()
    if (!keys.length) out += `\n - none`
    for (const k of keys) out += `\n - ${k}: ${summary.get(k)}`

    out += `\n\n=== matches (path:line:col • pattern • hint) ===`
    if (!findings.length) out += `\n - none`
    for (const f of findings) {
        out += `\n${f.file}:${f.lineNo}:${f.col} • ${f.name} • ${f.hint}`
        out += `\n    ${f.line}`
    }

    await fsp.mkdir(resolve(ROOT, 'artifacts'), { recursive: true })
    await fsp.writeFile(REPORT, out, 'utf8')
    console.log(out)
    console.log(`\n[report saved → ${relative(ROOT, REPORT)}]`)
}

main().catch(e => { console.error('[scan error]', e); process.exit(1) })
