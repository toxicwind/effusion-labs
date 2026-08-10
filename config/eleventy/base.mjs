// Modular Eleventy base config
import { dirs } from '../../src/utils/site.mjs'

export const projectRoot = process.cwd()
export const srcDir = `${projectRoot}/src`
export const outputDir = `${projectRoot}/${dirs.output}`
export const criticalPages = ['index.html', '404.html']
