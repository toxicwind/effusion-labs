import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const datasetPath = path.join(__dirname, 'generated', 'images.json')

export default class {
  data() {
    return {
      permalink: '/projects/lv-images/images.json',
      eleventyExcludeFromCollections: true,
      layout: null,
    }
  }

  async render() {
    try {
      return await readFile(datasetPath, 'utf8')
    } catch {
      return `${
        JSON.stringify(
          {
            error: 'Dataset not generated. Run npm run lv-images:update.',
            generatedAt: new Date().toISOString(),
          },
          null,
          2,
        )
      }\n`
    }
  }
}
