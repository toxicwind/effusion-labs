import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const resumePath = path.join(__dirname, '..', 'pages', 'resume', 'resume.json')

async function loadResume() {
  try {
    const raw = await readFile(resumePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[resume] unable to load resume data:', error?.message || error)
    return null
  }
}

export default loadResume
