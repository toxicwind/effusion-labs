#!/usr/bin/env node
/* Eleventy wrapper:
 * - Runs the Nunjucks ternary fixer
 * - Spawns Eleventy (serve/build)
 * - On failure, parses output and prints a codeframe or conflict details
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const ELEVENTY_BIN = path.join(ROOT, 'node_modules', '.bin', 'eleventy')
const IS_WIN = process.platform === 'win32'

function banner(msg) {
  console.log(`\x1b[36m[wrap]\x1b[0m ${msg}`)
}

function codeframe(srcText, line = 1, col = 1, ctx = 3) {
  const lines = srcText.split(/\r?\n/)
  const start = Math.max(1, line - ctx)
  const end = Math.min(lines.length, line + ctx)
  const width = String(end).length
  const out = []
  for (let n = start; n <= end; n++) {
    const pref =
      (n === line ? '>' : ' ') + ' ' + String(n).padStart(width) + ' | '
    out.push(pref + lines[n - 1])
    if (n === line && col && col > 0)
      out.push(' '.repeat(pref.length + col - 1) + '^')
  }
  return out.join('\n')
}

function rel(p) {
  try {
    return path.relative(ROOT, path.resolve(p))
  } catch {
    return p
  }
}

/** Try to parse a Nunjucks location from Eleventy/Nunjucks error text */
function extractNunjucksLocation(stderrText) {
  // Pattern 1: "(./path/file.njk) [Line 18, Column 15]"
  const re1 =
    /\((?<file>[^)]+)\)\s*\[Line\s*(?<line>\d+),\s*Column\s*(?<col>\d+)\]/
  const m1 = stderrText.match(re1)
  if (m1?.groups) {
    return {
      file: m1.groups.file,
      line: Number(m1.groups.line),
      col: Number(m1.groups.col),
      kind: 'nunjucks',
    }
  }
  // Pattern 2: "File: /abs/path\nLine: 18, Column: 15"
  const re2File = /File:\s*(?<file>[^\n]+)/
  const re2Pos = /Line:\s*(?<line>\d+),\s*Column:\s*(?<col>\d+)/
  const mf = stderrText.match(re2File)
  const mp = stderrText.match(re2Pos)
  if (mf?.groups && mp?.groups) {
    return {
      file: mf.groups.file.trim(),
      line: Number(mp.groups.line),
      col: Number(mp.groups.col),
      kind: 'nunjucks',
    }
  }
  return null
}

/** Parse DuplicatePermalinkOutputError block */
function extractPermalinkConflict(stderrText) {
  const head =
    /Output conflict: multiple input files are writing to\s+`(?<target>[^`]+)`/
  const mh = stderrText.match(head)
  if (!mh?.groups) return null

  const fileRe = /^\s*\d+\.\s+(?<file>\.\/[^\n]+)$/gm
  const files = []
  let m
  while ((m = fileRe.exec(stderrText))) files.push(m.groups.file)
  return { target: mh.groups.target, files }
}

/** Try to find front matter permalink line number in a template */
function findPermalinkLine(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8')
    // naive front matter scan
    const lines = txt.split(/\r?\n/)
    let inFm = false
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i]
      if (i === 0 && L.trim() === '---') {
        inFm = true
        continue
      }
      if (inFm && L.trim() === '---') {
        inFm = false
        break
      }
      if (inFm && /^\s*permalink\s*:/.test(L)) {
        return { line: i + 1, preview: L.trim() }
      }
    }
    return null
  } catch {
    return null
  }
}

async function runTernaryFixer() {
  if (process.env.FIX_NJK_TERNARY === '0') return
  try {
    const { fixRepoTernaries } = await import(
      path.join(ROOT, 'config', 'fix-njk-ternaries.mjs')
    )
    const report = await fixRepoTernaries({
      roots: ['src'],
      exts: ['.njk', '.md', '.html'],
      dryRun: !!process.env.DRY_RUN,
      logFile: '.njk-fix-report.json',
      quiet: !!process.env.FIX_NJK_QUIET,
    })
    if (!report.quiet && report.modified > 0) {
      banner(
        `ternary patched ${report.modified} file(s); log → ${report.logFile}`
      )
    }
  } catch (e) {
    banner(`ternary fixer failed (continuing): ${e?.message || e}`)
  }
}

async function main() {
  const argv = process.argv.slice(2)
  const eleventyArgs = argv // pass-through

  await runTernaryFixer()

  const bin = IS_WIN ? `${ELEVENTY_BIN}.cmd` : ELEVENTY_BIN
  const proc = spawn(bin, eleventyArgs, {
    stdio: ['inherit', 'pipe', 'pipe'], // capture to parse
    env: process.env,
  })

  let stderrBuf = ''
  let stdoutBuf = ''

  proc.stdout.on('data', d => {
    const s = String(d)
    stdoutBuf += s
    process.stdout.write(s)
  })
  proc.stderr.on('data', d => {
    const s = String(d)
    stderrBuf += s
    process.stderr.write(s)
  })

  proc.on('close', async code => {
    if (code === 0) process.exit(0)

    // Try Nunjucks parse location
    const njkLoc = extractNunjucksLocation(stderrBuf)
    if (njkLoc?.file) {
      try {
        const abs = path.resolve(njkLoc.file)
        const src = await fsp.readFile(abs, 'utf8')
        console.error('\n\x1b[31mNunjucks Parse Error\x1b[0m')
        console.error(
          `File: ${rel(abs)}\nLine: ${njkLoc.line}, Column: ${njkLoc.col}\n`
        )
        console.error(codeframe(src, njkLoc.line, njkLoc.col))
        process.exit(code || 1)
      } catch {
        // fall through
      }
    }

    // Try permalink conflict info
    const dup = extractPermalinkConflict(stderrBuf)
    if (dup?.files?.length >= 2) {
      console.error('\n\x1b[31mPermalink Output Conflict\x1b[0m')
      console.error(`Target: ${dup.target}`)
      for (const f of dup.files) {
        const abs = path.resolve(f)
        const hint = findPermalinkLine(abs)
        console.error(
          ` - ${rel(abs)}${hint ? `  (permalink @ line ${hint.line}: ${hint.preview})` : ''}`
        )
      }
      console.error(
        '\nFix: ensure those templates compute distinct `permalink` values (or disable one).'
      )
      process.exit(code || 1)
    }

    // Default: just echo Eleventy’s error
    process.exit(code || 1)
  })
}

main()
