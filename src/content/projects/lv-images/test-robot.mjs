// debug-sitemap.mjs - A lean script to test the core sitemap parsing logic.

import { XMLParser } from 'fast-xml-parser'
import { gunzipSync } from 'node:zlib'

const TARGET_HOST = 'https://us.louisvuitton.com'
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0'

// --- Reusable Fetch and Parse Logic ---

const isGzipMagic = (buf) =>
  Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b

async function fetchText(url) {
  console.log(`\n▶️ Fetching: ${url}`)
  const headers = { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en' }
  const res = await fetch(url, { headers, redirect: 'follow' })
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`)
  let buf = Buffer.from(await res.arrayBuffer())
  if (isGzipMagic(buf)) buf = gunzipSync(buf)
  const text = buf.toString('utf8')
  console.log(`✅ Fetched ${Math.round(text.length / 1024)} KB`)
  return text
}

function parseRobotsForSitemaps(text) {
  // CORRECTED: Use .replace() instead of .split() to handle URLs with colons.
  return (text.match(/^sitemap:\s*(.+)$/gim) || []).map(line =>
    line.replace(/^sitemap:\s*/i, '').trim()
  )
}

function* iterSitemapItems(xmlText) {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true })
  const root = parser.parse(xmlText)
  const urls = root?.urlset?.url ?? []
  for (const entry of Array.isArray(urls) ? urls : [urls]) {
    let images = entry?.image || entry?.['image:image'] || []
    for (const image of Array.isArray(images) ? images : [images]) {
      const src = image?.loc || image?.['image:loc'] || ''
      if (src) yield { src, pageUrl: entry?.loc || '' }
    }
  }
} // --- Main Debug Logic ---

;(async () => {
  try {
    // 1. Get sitemaps from robots.txt
    const robotsText = await fetchText(`${TARGET_HOST}/robots.txt`)
    const sitemapUrls = parseRobotsForSitemaps(robotsText)
    console.log('🔍 Found sitemaps in robots.txt:', sitemapUrls)

    // 2. Find the target image sitemap
    const imageUrl = sitemapUrls.find(url => url.includes('sitemap-image.xml'))
    if (!imageUrl) throw new Error('Could not find the image sitemap URL in robots.txt')
    console.log(`🎯 Target sitemap: ${imageUrl}`)

    // 3. Fetch and parse the image sitemap
    const sitemapXml = await fetchText(imageUrl)
    const items = Array.from(iterSitemapItems(sitemapXml))

    if (items.length === 0) {
      console.log('\n❌ No items found. The XML structure may be unexpected.')
    } else {
      console.log(`\n✅ Success! Found ${items.length} image items. Here are the first 5:`)
      console.log(items.slice(0, 5))
    }
  } catch (error) {
    console.error('\n💥 Debug script failed:', error)
    process.exit(1)
  }
})()
