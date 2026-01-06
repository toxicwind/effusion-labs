import { strict as assert } from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')

function runCommand(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      resolve({ code, output })
    })
  })
}

export async function run() {
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const env = {
    ...process.env,
    CI: 'true',
    LV_PIPELINE_TEST_MODE: '1',
  }
  const { code, output } = await runCommand(npmBin, ['run', 'crawl:pages', '--silent'], env)
  assert.equal(code, 0, 'crawl:pages should complete successfully in CI')
  assert.ok(
    output.includes('[lv-images] WARN: Live crawl requested in CI; pivoting to offline build.'),
    'pipeline should log CI pivot warning',
  )
  console.log('ci-correction.spec.mjs ✅')
}
