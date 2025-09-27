import { accessSync, constants } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
]

export function resolveChromium() {
  for (const candidate of CANDIDATES) {
    try {
      accessSync(candidate, constants.X_OK)
      return candidate
    } catch {
      // continue searching
    }
  }
  throw new Error('Chromium not found. Install via apt (chromium) or adjust paths.')
}

const modulePath = fileURLToPath(import.meta.url)

if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  try {
    const resolved = resolveChromium()
    process.stdout.write(`${resolved}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  }
}
