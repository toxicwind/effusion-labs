#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolveChromium } from '../resolve-chromium.mjs'
import { hydrateDataset, verifyBundle } from './bundle-lib.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const updateScript = path.join(projectRoot, 'src/content/projects/lv-images/update-dataset.mjs')
const doctorScript = path.join(projectRoot, 'tools', 'doctor.mjs')
const offlineShim = path.join(projectRoot, 'tools', 'offline-network-shim.cjs')
const eleventyCmd = path.join(projectRoot, 'node_modules', '@11ty', 'eleventy', 'cmd.cjs')

function logStep(message) {
  console.log(`\x1b[95m[lv-images]\x1b[0m ${message}`)
}

let chromiumPathCache = ''

function ensureChromiumReady() {
  if (chromiumPathCache) return chromiumPathCache
  const resolved = resolveChromium()
  let version = ''
  try {
    version = execFileSync(resolved, ['--version'], { encoding: 'utf8' }).trim()
  } catch (error) {
    console.warn(`[lv-images] Unable to read Chromium version from ${resolved}:`, error)
  }
  const versionLabel = version ? ` (${version})` : ''
  logStep(`Chromium @ ${resolved}${versionLabel}`)
  chromiumPathCache = resolved
  return chromiumPathCache
}

function spawnProcess(command, args = [], options = {}) {
  if (process.env.LV_PIPELINE_NOOP === '1') {
    logStep(`NOOP spawn → ${command} ${args.join(' ')}`)
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
      ...options,
    })
    child.on('error', (error) => {
      reject(error)
    })
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      if (signal) {
        reject(new Error(`${command} exited via signal ${signal}`))
        return
      }
      reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

function spawnNodeScript(scriptPath, args = [], env = {}) {
  const nodeArgs = [scriptPath, ...args]
  return spawnProcess(process.execPath, nodeArgs, {
    env: { ...process.env, ...env },
  })
}

function splitPassthrough(args) {
  const pivot = args.indexOf('--')
  if (pivot === -1) {
    return { options: args, passthrough: [] }
  }
  return {
    options: args.slice(0, pivot),
    passthrough: args.slice(pivot + 1),
  }
}

function parseOptionMap(optionArgs = []) {
  const map = new Map()
  for (const raw of optionArgs) {
    if (!raw.startsWith('--')) {
      map.set(raw, true)
      continue
    }
    const body = raw.slice(2)
    const eq = body.indexOf('=')
    if (eq === -1) {
      map.set(body, true)
    } else {
      const key = body.slice(0, eq)
      const value = body.slice(eq + 1)
      map.set(key, value)
    }
  }
  return map
}

function sanitizeMode(value) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'pages-images') return 'pages-images'
  if (normalized === 'pages' || normalized === 'page') return 'pages'
  return 'pages'
}

function sanitizeLabel(label, fallback) {
  if (!label) return fallback
  const trimmed = String(label).trim()
  if (!trimmed) return fallback
  return trimmed
}

async function runUpdate(
  { mode = 'pages', label = '', skipBundle = false, keepWorkdir = false } = {},
) {
  ensureChromiumReady()
  const args = []
  if (mode) args.push(`--mode=${mode}`)
  if (label) args.push(`--bundle-label=${label}`)
  if (skipBundle) args.push('--skip-bundle')
  if (keepWorkdir) args.push('--keep-workdir')
  const labelMsg = label ? ` label=${label}` : ''
  logStep(
    `Refreshing dataset via Playwright (mode=${mode}${labelMsg}${skipBundle ? ' skip-bundle' : ''}${
      keepWorkdir ? ' keep-workdir' : ''
    })`,
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
    if (strict && reason !== 'manifest-pointer') {
      throw new Error(`Bundle verification failed: ${reason}`)
    }
    console.warn(`[lv-images] Bundle verification failed: ${reason}`)
  } else {
    logStep('Bundle verification passed')
  }
  return result
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
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${heapFlag}`.trim() : heapFlag
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

async function runDoctor() {
  await spawnNodeScript(doctorScript)
}

export async function crawl(
  { mode = 'pages', label = '', skipBundle = false, keepWorkdir = false } = {},
) {
  const safeMode = sanitizeMode(mode)
  const fallbackLabel = safeMode === 'pages-images' ? 'pages-images' : 'pages'
  const safeLabel = sanitizeLabel(label, fallbackLabel)
  await runUpdate({ mode: safeMode, label: safeLabel, skipBundle, keepWorkdir })
}

export async function build({ keep = false, eleventyArgs = [] } = {}) {
  await runHydrate({ force: !keep })
  await runVerify({ strict: true })
  await runReportBuild({ reason: keep ? 'build-keep' : 'build' })
  await runEleventy({ offline: true, eleventyArgs })
}

export async function cycle({
  mode = 'pages',
  label = '',
  eleventyArgs = [],
  keepWorkdir = false,
} = {}) {
  await crawl({ mode, label, skipBundle: false, keepWorkdir })
  await build({ keep: false, eleventyArgs })
}

export async function doctor() {
  logStep('Running environment doctor')
  await runDoctor()
}

function usage() {
  console.log(
    [
      'LV images pipeline',
      '',
      'Usage: node tools/lv-images/pipeline.mjs <command> [options]',
      '',
      'Commands:',
      '  crawl [--mode=pages|pages-images] [--label=name] [--skip-bundle] [--keep-workdir]',
      '        Execute the live crawler and refresh the dataset snapshot.',
      '  build [--keep] [-- ... eleventy]',
      '        Hydrate from the latest bundle, verify, rebuild dataset cache, offline Eleventy.',
      '  cycle [--mode=pages|pages-images] [--label=name] [--keep-workdir] [-- ... eleventy]',
      '        Crawl live data then hydrate/verify/offline build in one run.',
      '  doctor',
      '        Run environment diagnostics.',
      '',
    ].join('\n'),
  )
}

async function main() {
  const [, , rawCommand = 'help', ...rest] = process.argv
  let command = rawCommand.toLowerCase()
  let args = rest

  if (process.env.CI === 'true' && command === 'crawl') {
    console.warn('[lv-images] WARN: Live crawl requested in CI; pivoting to offline build.')
    command = 'build'
  }

  try {
    switch (command) {
      case 'crawl': {
        const { options } = splitPassthrough(args)
        const flags = parseOptionMap(options)
        const mode = sanitizeMode(flags.get('mode'))
        const label = sanitizeLabel(
          flags.get('label'),
          mode === 'pages-images' ? 'pages-images' : 'pages',
        )
        const skipBundle = flags.has('skip-bundle')
        const keepWorkdir = flags.has('keep-workdir')
        await crawl({ mode, label, skipBundle, keepWorkdir })
        break
      }
      case 'build': {
        const { options, passthrough } = splitPassthrough(args)
        const flags = parseOptionMap(options)
        const keep = flags.has('keep') || flags.has('no-clean')
        await build({ keep, eleventyArgs: passthrough })
        break
      }
      case 'cycle': {
        const { options, passthrough } = splitPassthrough(args)
        const flags = parseOptionMap(options)
        const mode = sanitizeMode(flags.get('mode'))
        const label = sanitizeLabel(
          flags.get('label'),
          mode === 'pages-images' ? 'pages-images' : 'pages',
        )
        const keepWorkdir = flags.has('keep-workdir')
        await cycle({ mode, label, eleventyArgs: passthrough, keepWorkdir })
        break
      }
      case 'doctor': {
        await doctor()
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

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main()
}
