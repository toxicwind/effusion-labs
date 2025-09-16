#!/usr/bin/env node
// tools/doctor.mjs — quick env check for contributors and CI
import { execFileSync } from 'node:child_process'
import process from 'node:process'

function bin(name, args = ['--version']) {
  try {
    const out = execFileSync(name, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return String(out).trim().split(/\r?\n/)[0]
  } catch {
    return null
  }
}

const checks = []
checks.push(['node', process.versions.node, v => Number(v.split('.')[0]) >= 24])
checks.push(['npm', bin('npm'), v => !!v])
checks.push(['rg', bin('rg', ['--version']), v => !!v])
checks.push([
  'fd',
  bin('fd', ['--version']) || bin('fdfind', ['--version']),
  v => !!v,
])
checks.push(['jq', bin('jq', ['--version']), v => !!v])
checks.push(['sd', bin('sd', ['--version']), v => !!v])

let ok = true
for (const [name, version, pass] of checks) {
  const good = typeof pass === 'function' ? pass(version || '') : !!version
  ok &&= good
  const mark = good ? '✓' : '✗'
  console.log(`${mark} ${name} ${version || '(missing)'}`)
}

if (!ok) {
  console.error('\nSome tools are missing or out of date.')
  console.error('- Node >= 24 required')
  console.error('- Install ripgrep (rg), fd (or fdfind), jq, and sd')
  process.exit(1)
}

console.log('\nEnvironment looks good.')
