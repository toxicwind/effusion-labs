#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import process from 'node:process'

import { resolveChromium } from './resolve-chromium.mjs'

const MIN_NODE = '22.19.0'

function compareSemver(a, b) {
  const pa = String(a).split('.').map((part) => Number.parseInt(part, 10) || 0)
  const pb = String(b).split('.').map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(pa.length, pb.length)
  for (let index = 0; index < length; index++) {
    const diff = (pa[index] || 0) - (pb[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function readNpmVersion() {
  try {
    const out = execFileSync('npm', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.trim()
  } catch {
    return null
  }
}

const nodeVersion = process.versions.node
const nodeOk = compareSemver(nodeVersion, MIN_NODE) >= 0
const npmVersion = readNpmVersion()
const npmOk = Boolean(npmVersion)

let chromiumPath = ''
let chromiumOk = false
let chromiumError = ''
try {
  chromiumPath = resolveChromium()
  chromiumOk = true
} catch (error) {
  chromiumError = error instanceof Error ? error.message : String(error)
}

const ciValue = process.env.CI ?? '(undefined)'

const rows = [
  {
    label: 'Node',
    value: nodeVersion,
    detail: `>= ${MIN_NODE}`,
    ok: nodeOk,
  },
  {
    label: 'npm',
    value: npmVersion || '(missing)',
    detail: '',
    ok: npmOk,
  },
  {
    label: 'Chromium',
    value: chromiumPath || '(missing)',
    detail: chromiumError,
    ok: chromiumOk,
  },
  {
    label: 'CI env',
    value: String(ciValue),
    detail: '',
    ok: true,
  },
]

let allOk = true
for (const row of rows) {
  const mark = row.ok ? '✓' : '✗'
  console.log(`${mark} ${row.label}: ${row.value}${row.detail ? ` (${row.detail})` : ''}`)
  if (!row.ok) allOk = false
}

if (allOk) {
  console.log('\nEnvironment looks good.')
} else {
  console.log('\nEnvironment issues detected.')
}

if (!chromiumOk) {
  process.exitCode = 1
} else if (!nodeOk || !npmOk) {
  process.exitCode = 1
}
