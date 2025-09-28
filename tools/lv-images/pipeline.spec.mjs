import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

async function setupDatasetFixture() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'lv-bundle-'))
  const datasetRoot = path.join(tempRoot, 'dataset')
  const generatedDir = path.join(datasetRoot, 'generated')
  const lvDir = path.join(generatedDir, 'lv')
  await mkdir(path.join(lvDir, 'cache'), { recursive: true })
  await writeFile(
    path.join(lvDir, 'summary.json'),
    JSON.stringify({
      version: 1,
      generatedAt: '2024-01-01T00:00:00Z',
      totals: { images: 1, pages: 1 },
    }),
  )
  await writeFile(
    path.join(lvDir, 'items.ndjson'),
    JSON.stringify({ id: 'a', src: 'https://example.com/a.jpg' }),
  )

  process.env.LV_IMAGES_DATASET_ROOT = datasetRoot
  const bundleLib = await import(`../../tools/lv-images/bundle-lib.mjs?fixture=${Date.now()}`)
  const { bundleDataset, paths } = bundleLib
  await bundleDataset({ mode: 'pages', runLabel: 'spec' })
  delete process.env.LV_IMAGES_DATASET_ROOT

  return {
    datasetRoot,
    tempRoot,
    bundleDataset,
    paths,
    cleanup: () => rm(tempRoot, { recursive: true, force: true }),
  }
}

test('crawl defaults invalid modes to pages', async () => {
  const { crawl } = await import(`./pipeline.mjs?test=crawl`)
  const originalLog = console.log
  const logs = []
  process.env.LV_PIPELINE_NOOP = '1'
  console.log = (message, ...rest) => {
    logs.push([message, ...rest].join(' '))
  }
  try {
    await crawl({ mode: 'totally-invalid', label: '' })
  } finally {
    console.log = originalLog
    delete process.env.LV_PIPELINE_NOOP
  }
  assert(logs.some((line) => line.includes('mode=pages')))
})

test('cycle executes crawl and build flows in noop mode', async () => {
  const fixture = await setupDatasetFixture()
  const env = {
    ...process.env,
    LV_PIPELINE_NOOP: '1',
    LV_IMAGES_DATASET_ROOT: fixture.datasetRoot,
  }
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        path.resolve('tools/lv-images/pipeline.mjs'),
        'cycle',
        '--mode=pages-images',
        '--label=spec',
      ],
      { env },
    )
    const combined = `${stdout}${stderr}`
    assert(combined.includes('Hydrating dataset from bundle'), 'expected hydrate step to run')
  } finally {
    await fixture.cleanup()
  }
})

test('bundleDataset archives snapshots with history pruning', async () => {
  const fixture = await setupDatasetFixture()
  const { bundleDataset, paths, cleanup } = fixture

  try {
    const first = await bundleDataset({ mode: 'pages', runLabel: 'spec' })
    assert(first.history?.latest?.name)
    assert(first.history.entries.length >= 1)
    const archiveName = first.history.latest.name
    const archives = await readdir(paths.archivesDir)
    assert(archives.includes(archiveName))
    const history = JSON.parse(await readFile(paths.historyManifestPath, 'utf8'))
    assert.equal(history[0].name, archiveName)
    assert.match(archiveName, /^lv-\d{8}T\d{6}Z-pages(?:-[\da-z-]+)?\.tgz$/)

    for (let index = 0; index < 11; index++) {
      await writeFile(
        path.join(paths.lvDir, 'items.ndjson'),
        JSON.stringify({ id: `a-${index}`, src: 'https://example.com/a.jpg' }),
      )
      await bundleDataset({ mode: 'pages', runLabel: `spec-${index}` })
    }

    const prunedHistory = JSON.parse(await readFile(paths.historyManifestPath, 'utf8'))
    assert(prunedHistory.length <= 10)

    const latestPointer = await stat(paths.bundlePath)
    const latestArchive = await stat(path.join(paths.archivesDir, prunedHistory[0].name))
    assert.equal(latestPointer.size, latestArchive.size)
  } finally {
    await cleanup()
  }
})

test('verifyBundle tolerates git-lfs manifest pointers', async () => {
  const fixture = await setupDatasetFixture()
  const { cleanup, paths } = fixture

  try {
    await writeFile(
      paths.manifestPath,
      'version https://git-lfs.github.com/spec/v1\noid sha256:deadbeef\nsize 123',
    )
    process.env.LV_IMAGES_DATASET_ROOT = fixture.datasetRoot
    const { verifyBundle } = await import(
      `../../tools/lv-images/bundle-lib.mjs?check=${Date.now()}`
    )
    const result = await verifyBundle()
    assert.equal(result.ok, false)
    assert.equal(result.reason, 'manifest-pointer')
  } finally {
    delete process.env.LV_IMAGES_DATASET_ROOT
    await cleanup()
  }
})
