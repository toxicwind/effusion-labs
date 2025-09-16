#!/usr/bin/env node
// moved from utils/dev/eleventy-wrapper.mjs
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
function extractNunjucksLocation(stderrText) {
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
  return null
}
async function runTernaryFixer() {
  if (process.env.FIX_NJK_TERNARY === '0') return
  try {
    const { fixRepoTernaries } = await import(
      path.join(ROOT, 'tools', 'fix-njk-ternaries.mjs')
    )
    const report = await fixRepoTernaries({
      roots: ['src'],
      exts: ['.njk', '.md', '.html'],
      dryRun: !!process.env.DRY_RUN,
      logFile: '.njk-fix-report.json',
      quiet: !!process.env.FIX_NJK_QUIET,
    })
    if (!report.quiet && report.modified > 0)
      banner(
        `ternary patched ${report.modified} file(s); log → ${report.logFile}`
      )
  } catch (e) {
    banner(`ternary fixer failed (continuing): ${e?.message || e}`)
  }
}
async function main() {
  const argv = process.argv.slice(2)
  await runTernaryFixer()
  const bin = IS_WIN ? `${ELEVENTY_BIN}.cmd` : ELEVENTY_BIN
  const proc = spawn(bin, argv, {
    stdio: ['inherit', 'pipe', 'pipe'],
    env: process.env,
  })
  let stderrBuf = ''
  proc.stdout.on('data', d => process.stdout.write(String(d)))
  proc.stderr.on('data', d => {
    const s = String(d)
    stderrBuf += s
    process.stderr.write(s)
  })
  proc.on('close', async code => {
    if (code === 0) process.exit(0)
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
      } catch {}
    }
    process.exit(code || 1)
  })
}
main()
