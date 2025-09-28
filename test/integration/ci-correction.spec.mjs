import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import test from 'node:test'

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)), '..')

test('crawl command pivots to build in CI mode', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'lv-ci-'))
  const datasetRoot = path.join(tempRoot, 'dataset')
  const generatedDir = path.join(datasetRoot, 'generated')
  const lvDir = path.join(generatedDir, 'lv')
  await mkdir(path.join(lvDir, 'cache'), { recursive: true })
  await writeFile(path.join(lvDir, 'summary.json'), JSON.stringify({
    version: 1,
    generatedAt: '2024-01-01T00:00:00Z',
    totals: { images: 1, pages: 1 },
  }))
  await writeFile(path.join(lvDir, 'items.ndjson'), JSON.stringify({ id: 'ci', src: 'https://example.com/img.jpg' }))

  process.env.LV_IMAGES_DATASET_ROOT = datasetRoot
  const bundleLib = await import(`../../tools/lv-images/bundle-lib.mjs?ci=${Date.now()}`)
  const { bundleDataset } = bundleLib
  await bundleDataset({ mode: 'pages', runLabel: 'ci' })
  delete process.env.LV_IMAGES_DATASET_ROOT

  const env = {
    ...process.env,
    CI: 'true',
    LV_PIPELINE_NOOP: '1',
    LV_IMAGES_DATASET_ROOT: datasetRoot,
  }

  try {
    const { stdout, stderr } = await execFileAsync('npm', ['run', 'crawl:pages', '--silent'], {
      cwd: repoRoot,
      env,
    })
    const combined = `${stdout}${stderr}`
    assert(
      combined.includes('[lv-images] WARN: Live crawl requested in CI; pivoting to offline build.'),
      'expected CI pivot warning in output',
    )
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }
})
