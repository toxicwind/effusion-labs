import fg from 'fast-glob'
import fs from 'node:fs'

const files = await fg(['src/**/*.njk', 'src/**/*.md', '!**/node_modules/**'], {
  dot: true,
})
const tagRe = /\{\{[^}]*\?[^}]*:[^}]*\}\}|\{%\s*set\s+[^%]*\?[^:]*:[^%]*%\}/g

let hits = 0
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8')
  const m = txt.match(tagRe)
  if (m) {
    hits += m.length
    console.log(`\n# ${f}`)
    m.forEach(line => console.log(line.trim()))
  }
}
console.log(`\nTernary occurrences: ${hits}`)
process.exit(hits ? 1 : 0)
