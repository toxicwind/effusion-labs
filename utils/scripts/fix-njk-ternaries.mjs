import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'

/**
 * Rewrites SIMPLE top-level ternaries inside Nunjucks expressions to a filter form:
 *   {{ X ? A : B }}        → {{ X | ternary(A, B) }}
 *   {% set v = X ? A : B %}→ {% set v = X | ternary(A, B) %}
 *
 * It won’t touch nested/complex cases; those will be left as-is.
 */

function rewriteExpr(expr) {
  const s = expr
  let q = -1,
    c = -1,
    depth = 0,
    inStr = false,
    strCh = ''

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]

    // string handling
    if (inStr) {
      if (ch === strCh && s[i - 1] !== '\\') inStr = false
      continue
    }
    if (ch === "'" || ch === '"') {
      inStr = true
      strCh = ch
      continue
    }

    // bracket/paren depth
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}')
      depth = Math.max(0, depth - 1)
    else if (ch === '?' && depth === 0 && q < 0) q = i
    else if (ch === ':' && depth === 0 && q >= 0) {
      c = i
      break
    }
  }

  if (q < 0 || c < 0) return null

  const left = s.slice(0, q).trim()
  const mid = s.slice(q + 1, c).trim()
  const right = s.slice(c + 1).trim()
  if (!left || !mid || !right) return null

  return `${left} | ternary(${mid}, ${right})`
}

function transformContent(txt) {
  let changed = false
  let count = 0

  // {{ ... }} blocks
  txt = txt.replace(/\{\{\s*([^}]*)\s*\}\}/g, (m, inner) => {
    const r = rewriteExpr(inner)
    if (r) {
      changed = true
      count++
      return `{{ ${r} }}`
    }
    return m
  })

  // {% set x = ... %} blocks
  txt = txt.replace(
    /\{%\s*set\s+([a-zA-Z0-9_.$\[\]'"-]+)\s*=\s*([^%]*?)%\}/g,
    (m, lhs, rhs) => {
      const r = rewriteExpr(rhs.trim())
      if (r) {
        changed = true
        count++
        return `{% set ${lhs} = ${r} %}`
      }
      return m
    }
  )

  return { txt, changed, count }
}

export async function fixRepoTernaries({
  roots = ['src'],
  exts = ['.njk', '.md', '.html'],
  dryRun = false,
  logFile = '.njk-fix-report.json',
  quiet = false,
} = {}) {
  const patterns = []
  for (const root of roots) {
    for (const ext of exts) patterns.push(`${root}/**/*${ext}`)
  }
  const files = await fg(patterns, {
    dot: true,
    ignore: ['**/node_modules/**', '**/_site/**', '**/.cache/**'],
  })

  const results = []
  let modified = 0
  let totalRewrites = 0

  for (const f of files) {
    const orig = await fsp.readFile(f, 'utf8')
    const { txt, changed, count } = transformContent(orig)
    if (changed) {
      totalRewrites += count
      modified += 1
      if (!dryRun) {
        // keep a one-time backup next to the file
        const bak = f + '.bak'
        if (!fs.existsSync(bak)) await fsp.writeFile(bak, orig, 'utf8')
        await fsp.writeFile(f, txt, 'utf8')
      }
      if (!quiet)
        console.log(
          `[njk-fix] patched ${path.relative(process.cwd(), f)} (${count})`
        )
    }
    results.push({ file: f, changed, rewrites: count })
  }

  const report = {
    timestamp: new Date().toISOString(),
    roots,
    exts,
    dryRun,
    modified,
    totalRewrites,
    results,
    logFile,
    quiet,
  }

  try {
    await fsp.writeFile(logFile, JSON.stringify(report, null, 2), 'utf8')
  } catch {}

  return report
}
