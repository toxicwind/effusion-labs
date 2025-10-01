#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import libnpmsearch from 'libnpmsearch'
import npmFetch from 'npm-registry-fetch'

import {
  buildIndex,
  buildManifest,
  ensureRunsDirectory,
  indexOutPath,
  manifestOutPath,
  normalizeManifest,
  validateManifest,
} from './lv-images/run-manifest-lib.mjs'

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return raw ? JSON.parse(raw) : fallback
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

async function writeJson(filePath, data) {
  const payload = `${JSON.stringify(data, null, 2)}\n`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, payload, 'utf8')
}

async function registrySearch(keyword) {
  const results = await libnpmsearch(keyword, { size: 20 })
  for (const result of results) {
    console.log(`${result.name}@${result.version} - ${result.description}`)
  }
}

async function registryView(pkg) {
  const info = await npmFetch.json(pkg)
  console.log(JSON.stringify(info, null, 2))
}

async function registryAnalyze(keyword) {
  const results = await libnpmsearch(keyword, { size: 10, detailed: true })
  const enriched = []
  for (const entry of results) {
    const pkg = entry.package || entry
    try {
      const info = await npmFetch.json(pkg.name)
      const lastPublish = info.time?.modified || info.time?.[pkg.version] || 'unknown'
      enriched.push({
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        lastPublish,
        score: entry.score?.final ?? 0,
      })
    } catch {
      // ignore packages we cannot fetch
    }
  }
  enriched.sort((a, b) => b.score - a.score)
  console.log(JSON.stringify(enriched, null, 2))
}

async function registryInstall(pkg) {
  const info = await npmFetch.json(pkg)
  const version = info['dist-tags']?.latest || info.version
  execSync(`npm install ${pkg}@${version} --save-exact`, { stdio: 'inherit' })
}

function parseArgs(argv) {
  const flags = new Map()
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      positional.push(token)
      continue
    }
    const eq = token.indexOf('=')
    if (eq !== -1) {
      const key = token.slice(2, eq)
      const value = token.slice(eq + 1)
      flags.set(key, value === '' ? true : value)
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      flags.set(key, next)
      i += 1
    } else {
      flags.set(key, true)
    }
  }
  return { flags, positional }
}

async function lvMigrate() {
  await ensureRunsDirectory()
  const manifest = await buildManifest()
  await writeJson(manifestOutPath, manifest)
  const { valid, errors } = await validateManifest(manifest)
  if (!valid) {
    console.error('[lv-images] manifest validation failed during migrate:', errors)
    process.exitCode = 1
    return
  }
  const index = buildIndex(manifest)
  await writeJson(indexOutPath, index)
  console.log(
    `[lv-images] Wrote manifest (${manifest.runs.length} runs, ${manifest.artifacts.length} artifacts) and index`,
  )
}

async function lvNormalize({ checkOnly = false } = {}) {
  const manifest = await readJson(manifestOutPath, null)
  if (!manifest) {
    console.error('[lv-images] manifest missing; run `npm-utils lv migrate` first')
    process.exitCode = 1
    return
  }
  const normalized = normalizeManifest(manifest)
  const originalPayload = JSON.stringify(manifest)
  const normalizedPayload = JSON.stringify(normalized)
  if (originalPayload === normalizedPayload) {
    console.log('[lv-images] manifest already normalized')
    return
  }
  if (checkOnly) {
    console.error('[lv-images] manifest not normalized')
    process.exitCode = 1
    return
  }
  await writeJson(manifestOutPath, normalized)
  console.log('[lv-images] manifest normalized and rewritten')
}

async function lvValidate() {
  const manifest = await readJson(manifestOutPath, null)
  if (!manifest) {
    console.error('[lv-images] manifest missing; run `npm-utils lv migrate` first')
    process.exitCode = 1
    return
  }
  const { valid, errors } = await validateManifest(manifest)
  if (!valid) {
    console.error('[lv-images] manifest failed validation:')
    for (const err of errors) {
      console.error(' -', err.instancePath || '(root)', err.message || '')
    }
    process.exitCode = 1
    return
  }
  console.log(`[lv-images] manifest valid (${manifest.runs.length} runs)`)
  return manifest
}

async function lvIndex(argv) {
  const { flags } = parseArgs(argv)
  const manifest = await readJson(manifestOutPath, null)
  if (!manifest) {
    console.error('[lv-images] manifest missing; run `npm-utils lv migrate` first')
    process.exitCode = 1
    return
  }
  const index = buildIndex(manifest)
  if (flags.has('write')) {
    await writeJson(indexOutPath, index)
    console.log('[lv-images] index written to', path.relative(PROJECT_ROOT, indexOutPath))
    return
  }

  const artifactQuery = flags.get('artifact') || null
  if (artifactQuery) {
    const lookup = index.lookup.bySha256
    const artifacts = index.artifacts
    const byId = new Map(artifacts.map((item) => [item.id, item]))
    const shaMatch = lookup[artifactQuery]
    const artifact = byId.get(artifactQuery) || (shaMatch ? byId.get(shaMatch) : null)
    if (!artifact) {
      console.error(`[lv-images] artifact not found: ${artifactQuery}`)
      process.exitCode = 1
      return
    }
    console.log(JSON.stringify(artifact, null, 2))
    return
  }

  const runQuery = flags.get('run') || null
  if (runQuery) {
    const run = index.runs.find((item) => item.id === runQuery)
    if (!run) {
      console.error(`[lv-images] run not found: ${runQuery}`)
      process.exitCode = 1
      return
    }
    console.log(JSON.stringify(run, null, 2))
    return
  }

  const summary = {
    runs: index.runs.length,
    artifacts: index.artifacts.length,
    generatedAt: index.generatedAt,
  }
  console.log(JSON.stringify(summary, null, 2))
}

function usage() {
  console.log(
    [
      'Usage:',
      '  npm-utils registry <search|view|analyze|install> <value>',
      '  npm-utils <search|view|analyze|install> <value>          (legacy alias)',
      '  npm-utils lv <migrate|normalize|validate|index> [options]',
      '',
      'LV options:',
      '  migrate                Build manifest and index from generated dataset',
      '  normalize [--check]    Reformat manifest deterministically',
      '  validate               Validate manifest against schema',
      '  index [--write] [--artifact=<id|sha>] [--run=<id>]',
    ].join('\n'),
  )
}

async function main() {
  const [, , firstArg, secondArg, ...rest] = process.argv

  if (!firstArg) {
    usage()
    process.exitCode = 1
    return
  }

  const legacyCommands = new Set(['search', 'view', 'analyze', 'install'])

  if (legacyCommands.has(firstArg)) {
    const cmd = firstArg
    const arg = secondArg
    if (!arg) {
      console.error(`Usage: npm-utils ${cmd} <value>`)
      process.exit(1)
    }
    if (cmd === 'search') await registrySearch(arg)
    else if (cmd === 'view') await registryView(arg)
    else if (cmd === 'analyze') await registryAnalyze(arg)
    else if (cmd === 'install') await registryInstall(arg)
    return
  }

  if (firstArg === 'registry') {
    const cmd = secondArg
    const arg = rest[0]
    if (!cmd || !legacyCommands.has(cmd)) {
      usage()
      process.exitCode = 1
      return
    }
    if (!arg && cmd !== 'search' && cmd !== 'analyze') {
      console.error(`Usage: npm-utils registry ${cmd} <value>`)
      process.exit(1)
    }
    if (cmd === 'search') await registrySearch(arg || '')
    else if (cmd === 'view') await registryView(arg)
    else if (cmd === 'analyze') await registryAnalyze(arg || '')
    else if (cmd === 'install') await registryInstall(arg)
    return
  }

  if (firstArg === 'lv') {
    const subcommand = secondArg || 'migrate'
    if (!['migrate', 'normalize', 'validate', 'index'].includes(subcommand)) {
      usage()
      process.exitCode = 1
      return
    }
    if (subcommand === 'migrate') await lvMigrate()
    else if (subcommand === 'normalize') {
      const { flags } = parseArgs(rest)
      await lvNormalize({ checkOnly: flags.has('check') })
    } else if (subcommand === 'validate') {
      await lvValidate()
    } else if (subcommand === 'index') {
      await lvIndex(rest)
    }
    return
  }

  usage()
  process.exitCode = 1
}

main()
