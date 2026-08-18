import { strict as assert } from 'node:assert'
import { execFile } from 'node:child_process'
import { dirname } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { assertAllowed } from '../gateway/lib/host-allowlist.mjs'

const root = dirname(fileURLToPath(import.meta.url)) + '/..'

function execFileAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
      if (err) return reject(err)
      resolve({ stdout, stderr })
    })
  })
}

test('engine-detect outputs none when no engine', async () => {
  const { stdout } = await execFileAsync('sh', [
    `${root}/mcp-stack/scripts/engine-detect.sh`,
  ])
  assert.equal(stdout.trim(), 'none')
})

test('host allowlist blocks disallowed host', () => {
  process.env.HOST_ALLOWLIST = 'localhost,127.0.0.1'
  assert.throws(() => assertAllowed('https://example.com'), /host_not_allowed/)
})
