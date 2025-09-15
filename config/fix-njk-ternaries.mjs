import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'

const isText = p => /\.(njk|md|html)$/i.test(p)

function listFiles(dir, exts) {
  const out = []
  const ents = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of ents) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...listFiles(p, exts))
    else if (ent.isFile() && exts.includes(path.extname(p))) out.push(p)
  }
  return out
}

// Convert JS ternary → Nunjucks inline-if inside a single {{ ... }} expression.
// Handles one top-level ternary per expression; multiple/nested are processed
// by running the replacer repeatedly until stable.
function convertExpr(expr) {
  // Skip if there is no '?' or ':' at all
  if (!expr.includes('?') || !expr.includes(':')) return null

  // Find a top-level ? : (not inside quotes or parentheses)
  let depth = 0,
    quote = null,
    q = -1,
    c = -1
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i],
      prev = expr[i - 1]
    if (quote) {
      if (ch === quote && prev !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"') {
      quote = ch
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && ch === '?' && q === -1) q = i
    else if (depth === 0 && ch === ':' && q !== -1) {
      c = i
      break
    }
  }
  if (q === -1 || c === -1) return null

  const cond = expr.slice(0, q).trim()
  const whenTrue = expr.slice(q + 1, c).trim()
  const whenFalse = expr.slice(c + 1).trim()

  if (!cond || !whenTrue || !whenFalse) return null
  return `${whenTrue} if ${cond} else ${whenFalse}`
}

// Replace all `{{ ... ? ... : ... }}` blocks in content.
function rewriteContent(content) {
  const report = []
  let changed = false

  const re = /\{\{\s*([\s\S]*?)\s*\}\}/g // match {{ ... }} non-greedy
  const out = content.replace(re, (m, inner) => {
    let prev = inner,
      next = null,
      iterations = 0
    // apply repeatedly to handle multiple ternaries within the same {{ ... }}
    do {
      next = convertExpr(prev) ?? prev
      iterations++
      if (next !== prev) {
        report.push({ before: `{{ ${prev} }}`, after: `{{ ${next} }}` })
        prev = next
        changed = true
      }
    } while (next !== prev && iterations < 6)
    return `{{ ${prev} }}`
  })

  return { out, changed, report }
}

export async function fixRepoTernaries({
  roots = ['src'],
  exts = ['.njk'],
  dryRun = false,
  logFile = '.njk-fix-report.json',
} = {}) {
  const files = roots.flatMap(r => listFiles(r, exts)).filter(isText)
  const summary = { files: 0, changed: 0, edits: 0, details: [] }

  for (const file of files) {
    const raw = await fsp.readFile(file, 'utf8')
    const { out, changed, report } = rewriteContent(raw)
    summary.files++
    if (changed) {
      summary.changed++
      summary.edits += report.length
      summary.details.push({ file, edits: report.length })
      if (!dryRun) await fsp.writeFile(file, out, 'utf8')
    }
  }

  await fsp.writeFile(logFile, JSON.stringify(summary, null, 2), 'utf8')
  const msg = `[fix-njk-ternaries] scanned ${summary.files}, changed ${summary.changed} files, ${summary.edits} edits → ${logFile}`
  console.log(msg)
  return summary
}

// Allow running directly: `node scripts/fix-njk-ternaries.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  fixRepoTernaries({
    roots: ['src'],
    exts: ['.njk', '.md', '.html'],
    dryRun,
  }).catch(e => {
    console.error(e)
    process.exit(1)
  })
}
