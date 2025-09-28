#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveChromium } from '../resolve-chromium.mjs'
import {
  hydrateDataset,
  verifyBundle,
} from './bundle-lib.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const updateScript = path.join(projectRoot, 'src/content/projects/lv-images/update-dataset.mjs')
const offlineShim = path.join(projectRoot, 'tools/offline-network-shim.cjs')
const eleventyCmd = path.join(projectRoot, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs')

const COMMAND_ALIASES = new Map([
  ['crawl-pages-images', 'crawl-pages-images'],
  ['crawl-pages', 'crawl-pages'],
  ['hydrate-build', 'hydrate-build'],
  ['cycle-pages', 'cycle-pages'],
  ['cycle', 'cycle-pages'],
  ['help', 'help'],
])

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

async function runUpdate({ mode = 'pages', label = '', skipBundle = false } = {}) {
  ensureChromiumReady()
  const args = []
  if (mode) args.push(`--mode=${mode}`)
  if (label) args.push(`--bundle-label=${label}`)
  if (skipBundle) args.push('--skip-bundle')
  const labelMsg = label ? ` label=${label}` : ''
  logStep(
    `Refreshing dataset via Playwright (mode=${mode}${labelMsg}${skipBundle ? ' skip-bundle' : ''})`,
  )
  await spawnNodeScript(updateScript, args)
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

async function hydrateVerifyBuild({ keep = false, eleventyArgs = [] } = {}) {
  await runHydrate({ force: !keep })
  await runVerify({ strict: true })
  await runReportBuild({ reason: keep ? 'hydrate-build-keep' : 'hydrate-build' })
  await runEleventy({ offline: true, eleventyArgs })
}

async function runCrawlScenario({ mode = 'pages', label = '', skipBundle = false } = {}) {
  await runUpdate({ mode, label, skipBundle })
}

async function runCycleScenario({ mode = 'pages', label = '', eleventyArgs = [] } = {}) {
  await runUpdate({ mode, label })
  await hydrateVerifyBuild({ keep: false, eleventyArgs })
}

function usage() {
  console.log(
    [
      'LV images pipeline',
      '',
      'Usage: node tools/lv-images/pipeline.mjs <command> [options]',
      '',
      'Commands:',
      '  crawl-pages-images [--label=name]',
      '        Crawl live pages and images, then bundle snapshot.',
      '  crawl-pages [--label=name]',
      '        Crawl live pages (no images), then bundle snapshot.',
      '  hydrate-build [--keep] [-- ... eleventy]',
      '        Hydrate from bundle, verify, rebuild dataset cache, offline Eleventy.',
      '  cycle-pages [--label=name] [--mode=pages|pages-images] [-- ... eleventy]',
      '        Crawl then hydrate/verify/offline build in one run.',
      '',
    ].join('\n'),
  )
}

async function main() {
  const raw = (process.argv[2] || 'help').toLowerCase()
  const command = COMMAND_ALIASES.get(raw) || raw
  const args = process.argv.slice(3)
  try {
    switch (command) {
      case 'crawl-pages-images': {
        const { scenario } = splitArgs(args)
        const labelArg = scenario.find((arg) => arg.startsWith('--label='))
        const label = labelArg ? labelArg.split('=')[1] : 'pages-images'
        await runCrawlScenario({ mode: 'pages-images', label })
        break
      }
      case 'crawl-pages': {
        const { scenario } = splitArgs(args)
        const labelArg = scenario.find((arg) => arg.startsWith('--label='))
        const label = labelArg ? labelArg.split('=')[1] : 'pages'
        await runCrawlScenario({ mode: 'pages', label })
        break
      }
      case 'hydrate-build': {
        const { scenario, eleventy } = splitArgs(args)
        const keep = scenario.includes('--keep')
        await hydrateVerifyBuild({ keep, eleventyArgs: eleventy })
        break
      }
      case 'cycle-pages': {
        const { scenario, eleventy } = splitArgs(args)
        const labelArg = scenario.find((arg) => arg.startsWith('--label='))
        const modeArg = scenario.find((arg) => arg.startsWith('--mode='))
        const label = labelArg ? labelArg.split('=')[1] : 'pages-cycle'
        const requestedMode = modeArg ? modeArg.split('=')[1] : 'pages'
        const mode = ['pages', 'pages-images'].includes(requestedMode) ? requestedMode : 'pages'
        await runCycleScenario({ mode, label, eleventyArgs: eleventy })
        break
      }
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
