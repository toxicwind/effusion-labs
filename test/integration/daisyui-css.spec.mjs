import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { buildLean } from '../helpers/eleventy-env.mjs'

function readCssAssets(outDir) {
  const assetsDir = path.join(outDir, 'assets')
  if (!fs.existsSync(assetsDir)) {
    return []
  }
  const css = []
  for (const entry of fs.readdirSync(assetsDir)) {
    if (entry.endsWith('.css')) {
      const filePath = path.join(assetsDir, entry)
      css.push({
        name: entry,
        content: fs.readFileSync(filePath, 'utf8'),
      })
    }
  }
  return css
}

test('Vite build emits Tailwind + daisyUI bundle', async () => {
  const outDir = await buildLean('daisyui-css')
  const cssAssets = readCssAssets(outDir)
  assert(cssAssets.length > 0, 'expected at least one CSS asset from Vite build')
  const combined = cssAssets.map(asset => asset.content).join('\n')

  assert(
    combined.includes('.btn'),
    'expected daisyUI `.btn` styles to be present in generated CSS'
  )

  assert(
    !combined.includes('@tailwind'),
    'tailwind directives should be compiled out of production CSS'
  )
  assert(
    !combined.includes('@apply'),
    'raw `@apply` directives should be resolved during build'
  )
})
