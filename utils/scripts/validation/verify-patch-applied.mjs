#!/usr/bin/env node

/**
 * verify-patch-applied.mjs
 *
 * This script serves as a safety net to ensure that all patches defined
 * in the /patches directory have been successfully applied to the files
 * in /node_modules. It works by:
 * 1. Finding all `.patch` files.
 * 2. For each patch, it extracts the target file path and a sample line that was added.
 * 3. It reads the corresponding file in `node_modules`.
 * 4. It verifies the added line exists in the file content.
 * 5. If any verification fails, it exits with a non-zero code to fail the CI build.
 */
import fse from 'fs-extra'
import path from 'path'

// --- Configuration ---
const PATCHES_DIR = path.resolve(process.cwd(), 'patches')
const NODE_MODULES_DIR = path.resolve(process.cwd(), 'node_modules')

// --- ANSI Colors for logging ---
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

const log = (color, msg) => console.log(`${color}%s${COLORS.reset}`, msg)

async function main() {
  log(COLORS.cyan, '🔍 Verifying all patches have been applied...')

  if (!(await fse.exists(PATCHES_DIR))) {
    log(COLORS.green, '✅ No patches directory found. Nothing to verify.')
    process.exit(0)
  }

  const patchFiles = await fse.readdir(PATCHES_DIR)
  const validationTasks = patchFiles
    .filter(f => f.endsWith('.patch'))
    .map(p => verifyPatch(p))

  const results = await Promise.all(validationTasks)
  const failedPatches = results.filter(r => !r.success)

  if (failedPatches.length > 0) {
    log(COLORS.red, '\n❌ ERROR: Patch verification failed!')
    for (const failure of failedPatches) {
      console.log(`
      - Patch File: ${COLORS.yellow}${failure.patchFile}${COLORS.reset}
      - Target File: ${failure.targetFile}
      - Reason: ${COLORS.red}${failure.reason}${COLORS.reset}
      - Missing Content: "${failure.sentinelLine}"
      `)
    }
    console.log(
      `\n${COLORS.yellow}To fix this, try removing node_modules and running 'npm install' again.${COLORS.reset}`
    )
    process.exit(1)
  } else {
    log(COLORS.green, `✅ Successfully verified ${results.length} patches.`)
    process.exit(0)
  }
}

/**
 * Verifies a single patch file.
 * @param {string} patchFile - The filename of the patch (e.g., 'some-lib+1.2.3.patch')
 */
async function verifyPatch(patchFile) {
  const patchContent = await fse.readFile(
    path.join(PATCHES_DIR, patchFile),
    'utf-8'
  )
  const lines = patchContent.split('\n')

  // Heuristic: Find the first file path and the first added line of code to use as a check.
  const targetFileRelativePathLine = lines.find(l =>
    l.startsWith('--- a/node_modules/')
  )
  const sentinelLineAdded = lines.find(
    l => l.startsWith('+') && !l.startsWith('+++')
  )

  if (!targetFileRelativePathLine) {
    return {
      success: false,
      patchFile,
      reason: 'Could not determine target file from patch.',
    }
  }
  if (!sentinelLineAdded) {
    return {
      success: false,
      patchFile,
      reason: 'Could not find a sample added line in patch to verify.',
    }
  }

  // Extract paths and content
  const targetFile = targetFileRelativePathLine.replace('--- a/', '')
  const fullTargetPath = path.resolve(process.cwd(), targetFile)
  const sentinelLine = sentinelLineAdded.substring(1).trim() // Remove '+' and trim whitespace

  if (!(await fse.exists(fullTargetPath))) {
    return {
      success: false,
      patchFile,
      targetFile,
      sentinelLine,
      reason: 'Target file does not exist in node_modules.',
    }
  }

  const targetContent = await fse.readFile(fullTargetPath, 'utf-8')
  if (!targetContent.includes(sentinelLine)) {
    return {
      success: false,
      patchFile,
      targetFile,
      sentinelLine,
      reason: 'Patched content not found in target file.',
    }
  }

  return { success: true }
}

main().catch(err => {
  log(COLORS.red, 'An unexpected error occurred during patch verification:')
  console.error(err)
  process.exit(1)
})
