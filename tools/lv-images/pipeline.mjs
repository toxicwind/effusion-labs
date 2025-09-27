#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveChromium } from '../resolve-chromium.mjs'
import {
  bundleDataset,
  datasetStats as readDatasetStats,
  hydrateDataset,
  normalizeUrlmetaPaths,
  paths,
  verifyBundle,
} from './bundle-lib.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const updateScript = path.join(projectRoot, 'src/content/projects/lv-images/update-dataset.mjs')
const offlineShim = path.join(projectRoot, 'tools/offline-network-shim.cjs')
const eleventyCmd = path.join(projectRoot, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs')

const COMMAND_ALIASES = new Map([
  ['bundle', 'bundle'],
  ['pack', 'bundle'],
  ['refresh', 'update'],
  ['update', 'update'],
  ['hydrate', 'hydrate'],
  ['restore', 'hydrate'],
  ['verify', 'verify'],
  ['check', 'verify'],
  ['normalize', 'normalize'],
  ['stats', 'stats'],
  ['sync', 'sync'],
  ['full', 'build-local-fullinternet'],
  ['build-local-fullinternet', 'build-local-fullinternet'],
  ['offline', 'build-local-offline'],
  ['local', 'build-local-offline'],
  ['build', 'build-gitactions'],
  ['ci', 'build-gitactions'],
  ['build-local-offline', 'build-local-offline'],
  ['build-gitactions', 'build-gitactions'],
])

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx++
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(decimals)} ${units[idx]}`
}

function logStep(message) {
  console.log(`\x1b[95m[lv-images]\x1b[0m ${message}`)
}

let chromiumPathCache = ''

function ensureChromiumReady() {
  if (chromiumPathCache) return chromiumPathCache
  const path = resolveChromium()
  let version = ''
  try {
    version = execFileSync(path, ['--version'], { encoding: 'utf8' }).trim()
  } catch (error) {
    console.warn(`[lv-images] Unable to read Chromium version from ${path}:`, error)
  }
  const versionLabel = version ? ` (${version})` : ''
  logStep(`Chromium @ ${path}${versionLabel}`)
  chromiumPathCache = path
  return chromiumPathCache
}

function spawnProcess(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      ...options,
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} exited with code ${code}`))
      }
    })
  })
}

function spawnNodeScript(scriptPath, args = [], env = {}) {
  const nodeArgs = [scriptPath, ...args]
  return spawnProcess(process.execPath, nodeArgs, {
    env: { ...process.env, ...env },
  })
}

async function runUpdate() {
  ensureChromiumReady()
  logStep('Refreshing dataset via Playwright (full network)')
  await spawnNodeScript(updateScript)
  await runReportBuild({ reason: 'update' })
}

function logManifest(manifest) {
  if (!manifest) return
  const dataset = manifest.dataset || {}
  const archive = manifest.archive || {}
  const summary = manifest.summary || {}
  logStep(
    `Snapshot: ${dataset.fileCount ?? '?'} files, ${
      formatBytes(dataset.totalBytes ?? 0)
    } | version ${summary.version || '?'} @ ${
      summary.generatedAt || manifest.generatedAt || 'unknown'
    }`,
  )
  logStep(
    `Archive: ${archive.path || 'lv.bundle.tgz'} (${formatBytes(archive.size ?? 0)}) sha256=${
      archive.sha256 || ''
    }`,
  )
}

async function runBundle() {
  logStep('Bundling dataset snapshot')
  const manifest = await bundleDataset({ skipIfMissing: false, quiet: false })
  if (!manifest) throw new Error('Bundle creation failed')
  logManifest(manifest)
  return manifest
}

async function runHydrate({ force = true } = {}) {
  logStep(`Hydrating dataset from bundle${force ? ' (force clean)' : ''}`)
  const result = await hydrateDataset({ force, quiet: false })
  if (!result.hydrated) {
    throw new Error(`Hydrate failed (${result.reason || 'unknown'})`)
  }
  return result
}

async function runVerify({ strict = true } = {}) {
  logStep('Verifying bundle against manifest')
  const result = await verifyBundle()
  if (!result.ok) {
    const reason = result.reason || result.mismatches?.join(', ') || 'unknown'
    if (strict) {
      throw new Error(`Bundle verification failed: ${reason}`)
    }
    console.warn(`[lv-images] Bundle verification failed: ${reason}`)
  } else {
    logStep('Bundle verification passed')
  }
  return result
}

async function runNormalize() {
  logStep('Normalizing cached urlmeta paths')
  const { changed, count } = await normalizeUrlmetaPaths()
  logStep(`Processed ${count} urlmeta entries (${changed ? 'updated' : 'already clean'}).`)
}

async function printStats() {
  const stats = await readDatasetStats()
  const totalBytes = stats?.totalBytes ?? 0
  const files = stats?.entries?.length ?? 0
  logStep(`Dataset root: ${paths.lvDir}`)
  logStep(`Files: ${files}`)
  logStep(`Size: ${formatBytes(totalBytes)}`)
}

function splitArgs(args) {
  const pivot = args.indexOf('--')
  if (pivot === -1) return { scenario: args, eleventy: [] }
  return { scenario: args.slice(0, pivot), eleventy: args.slice(pivot + 1) }
}

async function runEleventy({ offline = false, eleventyArgs = [] } = {}) {
  const nodeArgs = []
  if (offline) {
    nodeArgs.push('--require', offlineShim)
  }
  nodeArgs.push(eleventyCmd, ...eleventyArgs)
  const env = { ...process.env }
  if (offline) env.BUILD_OFFLINE = '1'
  else delete env.BUILD_OFFLINE
  const heapFlag = '--max-old-space-size=8192'
  env.NODE_OPTIONS = env.NODE_OPTIONS
    ? `${env.NODE_OPTIONS} ${heapFlag}`.trim()
    : heapFlag
  await spawnProcess(process.execPath, nodeArgs, { env })
}

async function runReportBuild({ reason = 'manual' } = {}) {
  try {
    const modulePath = path.join(projectRoot, 'src', '_data', 'lvreport.js')
    const moduleUrl = pathToFileURL(modulePath).href
    const { buildAndPersistReport, DATASET_REPORT_FILE } = await import(moduleUrl)
    if (typeof buildAndPersistReport !== 'function') {
      throw new Error('lvreport module missing buildAndPersistReport export')
    }
    logStep(`Rebuilding lvreport dataset cache (${reason})`)
    const { payload } = await buildAndPersistReport({ log: logStep })
    const totals = payload?.totals || {}
    const relPath = DATASET_REPORT_FILE
      ? path.relative(projectRoot, DATASET_REPORT_FILE)
      : 'src/content/projects/lv-images/generated/lv/lvreport.dataset.json'
    logStep(
      `lvreport cached → ${relPath} (images=${totals.images ?? '?'}, pages=${totals.pages ?? '?'})`,
    )
  } catch (error) {
    console.error(`[lv-images] lvreport build failed (${reason}):`, error?.message || error)
    throw error
  }
}

async function runSync() {
  await runUpdate()
  await runBundle()
  await runVerify({ strict: true })
}

async function buildLocalFullInternet(eleventyArgs) {
  await runSync()
  await runEleventy({ offline: false, eleventyArgs })
}

async function buildLocalOffline(args) {
  const { scenario, eleventy } = splitArgs(args)
  const keep = scenario.includes('--keep')
  await runHydrate({ force: !keep })
  await runVerify({ strict: false })
  await runReportBuild({ reason: keep ? 'build-local-offline-keep' : 'build-local-offline' })
  await runEleventy({ offline: true, eleventyArgs: eleventy })
}

async function buildGitActions(args) {
  const { eleventy } = splitArgs(args)
  await runHydrate({ force: true })
  await runVerify({ strict: true })
  const defaultArgs = eleventy.length ? eleventy : ['--quiet']
  await runReportBuild({ reason: 'build-gitactions' })
  await runEleventy({ offline: true, eleventyArgs: defaultArgs })
}

function usage() {
  console.log(
    `LV images pipeline\n\nUsage: node tools/lv-images/pipeline.mjs <command> [options]\n\nCommands:\n  update|refresh                 Fetch the latest dataset via Playwright\n  bundle|pack                    Create lv.bundle.tgz and manifest\n  hydrate [--keep]               Restore generated/lv from bundle\n  verify [--soft]                Check archive + manifest integrity\n  normalize                      Fix urlmeta paths inside cache\n  stats                          Print dataset file/size stats\n  sync                           update + bundle + verify\n  build|ci [-- ... eleventy]     Hydrate + verify + offline Eleventy (strict)\n  build-local-fullinternet [-- ... eleventy]\n                                 Full local build with network crawl\n  offline|local [--keep] [-- ... eleventy]\n                                 Hydrate + verify + offline Eleventy build\n`,
  )
}

async function main() {
  const raw = (process.argv[2] || 'help').toLowerCase()
  const command = COMMAND_ALIASES.get(raw) || raw
  const args = process.argv.slice(3)
  try {
    switch (command) {
      case 'update':
        await runUpdate()
        break
      case 'bundle':
        await runBundle()
        break
      case 'hydrate': {
        const keep = args.includes('--keep')
        await runHydrate({ force: !keep })
        break
      }
      case 'verify': {
        const soft = args.includes('--soft')
        await runVerify({ strict: !soft })
        break
      }
      case 'normalize':
        await runNormalize()
        break
      case 'stats':
        await printStats()
        break
      case 'sync':
        await runSync()
        break
      case 'build-local-fullinternet': {
        const { eleventy } = splitArgs(args)
        await buildLocalFullInternet(eleventy)
        break
      }
      case 'build-local-offline':
        await buildLocalOffline(args)
        break
      case 'build-gitactions':
        await buildGitActions(args)
        break
      case 'help':
      case '--help':
      case '-h':
      default:
        usage()
        if (!['help', '--help', '-h'].includes(command)) process.exitCode = 1
    }
  } catch (error) {
    console.error('[lv-images] Fatal:', error?.message || error)
    if (error?.stack) console.error(error.stack)
    process.exitCode = 1
  }
}

main()
