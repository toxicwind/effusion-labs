import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..', '..')
const datasetRoot = path.join(projectRoot, 'src/content/projects/lv-images')
const generatedDir = path.join(datasetRoot, 'generated')
const lvDir = path.join(generatedDir, 'lv')
const archivesDir = path.join(generatedDir, 'archives')
const manifestOutDir = path.join(datasetRoot, 'runs')
const manifestOutPath = path.join(manifestOutDir, 'manifest.json')
const indexOutPath = path.join(manifestOutDir, 'index.json')
const schemaPath = path.join(projectRoot, 'schema', 'lv-images-manifest.schema.json')

const CONFIG_FILES = [
  'config/hosts.txt',
  'config/hosts.txt-limited',
  'config/hosts.active.snapshot.txt',
  'config/hosts.banned.ndjson',
  'config/locales.json',
  'config/subdomains.json',
  'config/settings.json',
]

const DEFAULT_SETTINGS = {
  defaults: {
    mode: 'metadata-only',
  },
  toggles: {
    htmlScraping: false,
    cachePages: false,
    cacheImages: false,
  },
}

const MODE_MAP = new Map([
  ['metadata', 'metadata-only'],
  ['metadata-only', 'metadata-only'],
  ['pages', 'pages'],
  ['pages-images', 'pages-images'],
])

let validatorInstance = null

function posixify(filePath) {
  return filePath.split(path.sep).join('/')
}

function relToProject(filePath) {
  return posixify(path.relative(projectRoot, filePath))
}

async function readJsonFile(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return raw ? JSON.parse(raw) : fallback
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback
    throw error
  }
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
}

function camelToDash(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sanitizeIso(iso) {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    return date.toISOString()
  } catch {
    return null
  }
}

function normalizeMode(mode, fallback = 'metadata-only') {
  if (!mode) return fallback
  const normalized = MODE_MAP.get(String(mode).toLowerCase())
  return normalized || fallback
}

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function sortObjectByKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)))
}

async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('error', (error) => {
      if (error?.code === 'ENOENT') {
        resolve(null)
      } else {
        reject(error)
      }
    })
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function describeFile(relativePath) {
  const absPath = path.join(datasetRoot, relativePath)
  if (!(await fileExists(absPath))) return null
  const [meta, sha256] = await Promise.all([stat(absPath), hashFile(absPath)])
  return {
    path: relToProject(absPath),
    size: meta.size,
    sha256,
  }
}

async function describeConfigFiles() {
  const descriptors = []
  for (const relPath of CONFIG_FILES) {
    const absPath = path.join(datasetRoot, relPath)
    if (!(await fileExists(absPath))) continue
    const raw = await readFile(absPath, 'utf8')
    const sha = createHash('sha256').update(raw).digest('hex')
    const lineCount = raw === '' ? 0 : raw.split(/\r?\n/).length
    descriptors.push({
      path: relToProject(absPath),
      sha256: sha,
      size: Buffer.byteLength(raw),
      lineCount,
      kind: relPath.endsWith('.json') ? 'json' : relPath.endsWith('.ndjson') ? 'ndjson' : 'text',
    })
  }
  descriptors.sort((a, b) => a.path.localeCompare(b.path))
  return descriptors
}

function runIdFromTimestamp(timestamp, mode) {
  const iso = sanitizeIso(timestamp) || timestamp || 'unknown'
  const compact = iso
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '')
    .replace(/[^0-9TZ]/g, '')
  const modeSlug = camelToDash(mode || 'unk') || 'unk'
  return `run-${compact}-${modeSlug}`
}

function togglesFromCapture(run) {
  const capture = run?.capture || {}
  const pages = Boolean(capture.pages)
  const images = Boolean(capture.images)
  return {
    htmlScraping: pages || images,
    cachePages: pages,
    cacheImages: images,
  }
}

function inferMode(run) {
  const explicit = normalizeMode(run?.mode, null)
  if (explicit) return explicit
  const capture = run?.capture || {}
  if (capture.pages && capture.images) return 'pages-images'
  if (capture.pages) return 'pages'
  if (capture.images) return 'pages-images'
  const totals = run?.totals || {}
  if (toNumber(totals.images) > 0 && toNumber(totals.pages) > 0) return 'pages-images'
  if (toNumber(totals.pages) > 0) return 'pages'
  return 'metadata-only'
}

function normalizeMetrics(metrics = {}) {
  const result = {}
  for (const [key, value] of Object.entries(metrics)) {
    result[key] = toNumber(value)
  }
  return sortObjectByKeys(result)
}

function normalizeTotals(totals = {}) {
  const result = {}
  for (const [key, value] of Object.entries(totals)) {
    result[key] = toNumber(value)
  }
  return sortObjectByKeys(result)
}

async function collectArtifacts() {
  const artifactsBySha = new Map()

  const addArtifact = (artifact) => {
    if (!artifact?.sha256) return
    const existing = artifactsBySha.get(artifact.sha256)
    if (existing) {
      const mergedPaths = new Set([...(existing.paths || []), ...(artifact.paths || [])])
      existing.paths = Array.from(mergedPaths).sort()
      if (!existing.generatedAt && artifact.generatedAt) existing.generatedAt = artifact.generatedAt
      if (!existing.mode && artifact.mode) existing.mode = artifact.mode
      if (!existing.label && artifact.label) existing.label = artifact.label
      if (artifact.kind && existing.kind !== artifact.kind) {
        existing.kind = `${existing.kind},${artifact.kind}`
      }
      return existing
    }
    const clone = {
      id: artifact.id,
      kind: artifact.kind || 'unknown',
      sha256: artifact.sha256,
      size: artifact.size ?? null,
      generatedAt: sanitizeIso(artifact.generatedAt) || null,
      mode: artifact.mode || null,
      label: artifact.label || null,
      paths: (artifact.paths || []).map((p) => posixify(p)).sort(),
    }
    artifactsBySha.set(clone.sha256, clone)
    return clone
  }

  const bundleManifestPath = path.join(generatedDir, 'lv.bundle.json')
  if (await fileExists(bundleManifestPath)) {
    const manifestJson = await readJsonFile(bundleManifestPath, null)
    const desc = await describeFile('generated/lv.bundle.json')
    addArtifact({
      id: `manifest-${desc?.sha256?.slice(0, 12) || camelToDash(manifestJson?.generatedAt) || 'current'}`,
      kind: 'manifest',
      sha256: desc?.sha256 || null,
      size: desc?.size ?? null,
      generatedAt: manifestJson?.generatedAt || null,
      mode: manifestJson?.mode || null,
      label: manifestJson?.runLabel || null,
      paths: desc ? [desc.path] : [],
    })
  }

  const summaryPath = path.join(lvDir, 'summary.json')
  if (await fileExists(summaryPath)) {
    const summary = await readJsonFile(summaryPath, null)
    const absPath = path.join(lvDir, 'summary.json')
    const [meta, sha] = await Promise.all([stat(absPath), hashFile(absPath)])
    addArtifact({
      id: `summary-${sha?.slice(0, 12) || 'latest'}`,
      kind: 'summary',
      sha256: sha,
      size: meta?.size ?? null,
      generatedAt: summary?.generatedAt || null,
      mode: summary?.mode || null,
      label: summary?.label || null,
      paths: [relToProject(absPath)],
    })
  }

  const stableBundlePath = path.join(generatedDir, 'lv.bundle.tgz')
  if (await fileExists(stableBundlePath)) {
    const [meta, sha] = await Promise.all([stat(stableBundlePath), hashFile(stableBundlePath)])
    addArtifact({
      id: `bundle-latest-${sha?.slice(0, 12) || 'current'}`,
      kind: 'bundle-latest',
      sha256: sha,
      size: meta.size,
      generatedAt: null,
      paths: [relToProject(stableBundlePath)],
    })
  }

  const archivesHistoryPath = path.join(archivesDir, 'history.json')
  const archives = await readJsonFile(archivesHistoryPath, [])
  for (const entry of archives || []) {
    addArtifact({
      id: `archive-${camelToDash(entry.generatedAt || entry.name) || entry.sha256?.slice(0, 12) || 'unknown'}`,
      kind: 'archive',
      sha256: entry.sha256 || null,
      size: entry.size ?? null,
      generatedAt: entry.generatedAt || null,
      mode: entry.mode || null,
      label: entry.label || null,
      paths: [
        relToProject(path.join(datasetRoot, entry.path || '')),
        ...(entry.legacyPath ? [relToProject(path.join(datasetRoot, entry.legacyPath))] : []),
      ].filter(Boolean),
    })
  }

  const artifacts = Array.from(artifactsBySha.values())
  artifacts.sort((a, b) => {
    const aTime = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
    const bTime = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
    if (aTime && bTime && aTime !== bTime) return bTime - aTime
    return a.id.localeCompare(b.id)
  })
  artifacts.forEach((artifact, index) => {
    if (!artifact.id) {
      artifact.id = `artifact-${index + 1}`
    }
  })
  return artifacts
}

function matchArtifactByRole(artifacts, role, run) {
  const candidates = artifacts.filter((artifact) => {
    if (role === 'bundle') {
      return artifact.kind.includes('bundle') || artifact.kind.includes('archive')
    }
    if (role === 'summary') return artifact.kind.includes('summary')
    if (role === 'manifest') return artifact.kind.includes('manifest')
    return false
  })

  if (candidates.length === 0) return null
  const runTime = new Date(run.timestamp || 0).getTime() || 0
  candidates.sort((a, b) => {
    const aTime = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
    const bTime = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
    const aDelta = Math.abs((aTime || 0) - runTime)
    const bDelta = Math.abs((bTime || 0) - runTime)
    if (aDelta !== bDelta) return aDelta - bDelta
    return a.id.localeCompare(b.id)
  })
  return candidates[0]
}

function cloneConfigSnapshot(configDescriptors) {
  return configDescriptors.map((descriptor) => ({
    path: descriptor.path,
    sha256: descriptor.sha256,
  }))
}

export async function buildManifest() {
  const [settings, configDescriptors, runsHistory, artifacts] = await Promise.all([
    readJsonFile(path.join(datasetRoot, 'config', 'settings.json'), DEFAULT_SETTINGS),
    describeConfigFiles(),
    readJsonFile(path.join(lvDir, 'runs-history.json'), []),
    collectArtifacts(),
  ])

  const manifestRuns = []
  for (const run of runsHistory || []) {
    const timestamp = sanitizeIso(run.timestamp) || run.timestamp || null
    const mode = inferMode(run)
    const runToggles = togglesFromCapture(run)
    const artifactsForRun = []
    const bundleArtifact = matchArtifactByRole(artifacts, 'bundle', { timestamp, mode })
    if (bundleArtifact) {
      artifactsForRun.push({ role: 'bundle', artifactId: bundleArtifact.id })
    }
    const summaryArtifact = matchArtifactByRole(artifacts, 'summary', { timestamp, mode })
    if (summaryArtifact) {
      artifactsForRun.push({ role: 'summary', artifactId: summaryArtifact.id })
    }
    const manifestArtifact = matchArtifactByRole(artifacts, 'manifest', { timestamp, mode })
    if (manifestArtifact) {
      artifactsForRun.push({ role: 'manifest', artifactId: manifestArtifact.id })
    }

    manifestRuns.push({
      id: runIdFromTimestamp(timestamp, mode),
      timestamp,
      mode,
      label: run.label || null,
      toggles: {
        htmlScraping: Boolean(runToggles.htmlScraping),
        cachePages: Boolean(runToggles.cachePages),
        cacheImages: Boolean(runToggles.cacheImages),
      },
      inputs: {
        config: cloneConfigSnapshot(configDescriptors),
      },
      metrics: normalizeMetrics(run.metrics || {}),
      totals: normalizeTotals(run.totals || {}),
      capture: run.capture
        ? {
          pages: Boolean(run.capture.pages),
          images: Boolean(run.capture.images),
        }
        : null,
      artifacts: artifactsForRun,
    })
  }

  manifestRuns.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    return a.id.localeCompare(b.id)
  })

  const manifest = {
    version: '2025-10-01',
    generatedAt: new Date().toISOString(),
    defaults: {
      mode: normalizeMode(settings?.defaults?.mode, 'metadata-only'),
      toggles: {
        htmlScraping: Boolean(settings?.toggles?.htmlScraping),
        cachePages: Boolean(settings?.toggles?.cachePages),
        cacheImages: Boolean(settings?.toggles?.cacheImages),
      },
    },
    inputs: {
      config: configDescriptors,
      tools: await collectToolVersions(),
    },
    runs: manifestRuns,
    artifacts,
  }

  return normalizeManifest(manifest)
}

export function normalizeManifest(manifest) {
  const cloned = structuredClone(manifest)
  cloned.inputs.config.sort((a, b) => a.path.localeCompare(b.path))
  cloned.artifacts.forEach((artifact) => {
    if (Array.isArray(artifact.paths)) artifact.paths.sort()
  })
  cloned.artifacts.sort((a, b) => {
    const aTime = a.generatedAt ? new Date(a.generatedAt).getTime() : 0
    const bTime = b.generatedAt ? new Date(b.generatedAt).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    return a.id.localeCompare(b.id)
  })
  cloned.runs.forEach((run) => {
    if (run.artifacts) {
      run.artifacts.sort((a, b) => a.role.localeCompare(b.role))
    }
    run.metrics = sortObjectByKeys(run.metrics || {})
    run.totals = sortObjectByKeys(run.totals || {})
    if (run.capture) {
      run.capture = {
        pages: Boolean(run.capture.pages),
        images: Boolean(run.capture.images),
      }
    }
  })
  cloned.runs.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
    if (aTime !== bTime) return bTime - aTime
    return a.id.localeCompare(b.id)
  })
  return cloned
}

async function collectToolVersions() {
  const pkgJson = await readJsonFile(path.join(projectRoot, 'package.json'), {})
  const devDeps = pkgJson.devDependencies || {}
  const deps = pkgJson.dependencies || {}
  const relevant = {
    '@playwright/test': devDeps['@playwright/test'] || null,
    'playwright-extra': devDeps['playwright-extra'] || null,
    puppeteer: devDeps.puppeteer || null,
    '@tailwindcss/vite': devDeps['@tailwindcss/vite'] || null,
    node: process.version,
  }
  return Object.fromEntries(
    Object.entries(relevant)
      .filter(([, value]) => Boolean(value))
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

export function buildIndex(manifest) {
  const usageByArtifact = new Map()
  for (const run of manifest.runs || []) {
    for (const ref of run.artifacts || []) {
      if (!usageByArtifact.has(ref.artifactId)) usageByArtifact.set(ref.artifactId, [])
      usageByArtifact.get(ref.artifactId).push({ runId: run.id, role: ref.role })
    }
  }

  const runsIndex = (manifest.runs || []).map((run) => ({
    id: run.id,
    timestamp: run.timestamp,
    mode: run.mode,
    toggles: run.toggles,
    artifacts: (run.artifacts || []).map((ref) => ({ role: ref.role, artifactId: ref.artifactId })),
  }))

  const artifactLookupBySha = {}
  const artifactsIndex = (manifest.artifacts || []).map((artifact) => {
    if (artifact.sha256) artifactLookupBySha[artifact.sha256] = artifact.id
    return {
      id: artifact.id,
      kind: artifact.kind,
      sha256: artifact.sha256,
      size: artifact.size,
      generatedAt: artifact.generatedAt,
      mode: artifact.mode,
      label: artifact.label,
      paths: artifact.paths,
      usage: usageByArtifact.get(artifact.id) || [],
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    runs: runsIndex,
    artifacts: artifactsIndex,
    lookup: {
      bySha256: artifactLookupBySha,
    },
  }
}

async function getValidator() {
  if (validatorInstance) return validatorInstance
  const schema = await readJsonFile(schemaPath, null)
  if (!schema) {
    throw new Error(`LV images manifest schema missing at ${relToProject(schemaPath)}`)
  }
  const ajv = new Ajv({ strict: false, allErrors: true })
  addFormats(ajv)
  validatorInstance = ajv.compile(schema)
  return validatorInstance
}

export async function validateManifest(manifest) {
  const validate = await getValidator()
  const ok = validate(manifest)
  return {
    valid: Boolean(ok),
    errors: ok ? [] : validate.errors || [],
  }
}

export {
  manifestOutDir,
  manifestOutPath,
  indexOutPath,
  datasetRoot,
  generatedDir,
  lvDir,
}

export async function ensureRunsDirectory() {
  await mkdir(manifestOutDir, { recursive: true })
}

