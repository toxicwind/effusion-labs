import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { XMLParser } from 'fast-xml-parser'
import pLimit from 'p-limit'
import { Agent, setGlobalDispatcher } from 'undici'

/* ============================================================
   CONFIG
   ============================================================ */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedDir = path.join(__dirname, 'generated')
const datasetPath = path.join(generatedDir, 'images.json')

// 1) Crawl behavior
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0' // normal desktop UA
const CONCURRENCY = 14                  // parallel fetches (tune 12–20)
const REQUEST_TIMEOUT_MS = 3000
const MAX_RETRIES = 0
const RETRY_BASE_MS = 400
const STREAM_FLUSH_EVERY = 2000         // stream flush cadence

// 2) Discovery toggle (true = do the exhaustive discovery pass first)
const ENABLE_DISCOVERY = true

// 3) Baseline grid (kept as seed; discovery will union & dedupe)
const SUBDOMAINS = [
  'us', 'hk', 'eu', 'en', 'it', 'ca', 'jp', 'kr'
]
const LOCALES = [
  'eng_US', 'eng_E1',
]

// 4) Discovery sources (hosts + locale aliases)
const CANDIDATE_HOSTS = [
  'ae.louisvuitton.com', 'at.louisvuitton.com', 'au.louisvuitton.com', 'be.louisvuitton.com',
  'br.louisvuitton.com', 'ca.louisvuitton.com', 'de.louisvuitton.com', 'en.louisvuitton.com',
  'es.louisvuitton.com', 'eu.louisvuitton.com', 'fi.louisvuitton.com', 'fr.louisvuitton.com',
  'hk.louisvuitton.com', 'id.louisvuitton.com', 'ie.louisvuitton.com', 'in.louisvuitton.com',
  'it.louisvuitton.com', 'jp.louisvuitton.com', 'kr.louisvuitton.com', 'kw.louisvuitton.com',
  'la.louisvuitton.com', 'lu.louisvuitton.com', 'mc.louisvuitton.com', 'me.louisvuitton.com',
  'mx.louisvuitton.com', 'my.louisvuitton.com', 'nl.louisvuitton.com', 'nz.louisvuitton.com',
  'ru.louisvuitton.com', 'sa.louisvuitton.com', 'sg.louisvuitton.com', 'th.louisvuitton.com',
  'tw.louisvuitton.com', 'uk.louisvuitton.com', 'us.louisvuitton.com', 'vn.louisvuitton.com',
  // …environment and preview/staging mirrors (kept because you asked for breadth)
  'account.louisvuitton.com', 'advisor-prp.louisvuitton.com', 'adyennotification.louisvuitton.com',
  'ap-ppt.louisvuitton.com', 'ap.louisvuitton.com', 'api-cn-catalog.louisvuitton.com',
  'api-eu-catalog.louisvuitton.com', 'api-sg-catalog.louisvuitton.com', 'api-tpc.louisvuitton.com',
  'api.louisvuitton.com', 'as-api.louisvuitton.com', 'at-ppt.louisvuitton.com',
  'au-i3f.louisvuitton.com', 'au-ppt.louisvuitton.com', 'authme.louisvuitton.com',
  'be-ppt.louisvuitton.com', 'br-i3f.louisvuitton.com', 'br-ppt.louisvuitton.com',
  'ca-i3f.louisvuitton.com', 'ca-ppt.louisvuitton.com', 'ca-prp.louisvuitton.com',
  'catalog-api-eu-prp.louisvuitton.com', 'catalog-api-eu.louisvuitton.com', 'catalog-api-int.louisvuitton.com',
  'catalog-api-sg-prp.louisvuitton.com', 'catalog-api-sg.louisvuitton.com', 'catalog-wecom-prp.louisvuitton.com',
  'catalog-wecom.louisvuitton.com', 'catalog.louisvuitton.com', 'cbsdecisionmanager-ng.louisvuitton.com',
  'certificates.louisvuitton.com', 'click.client.louisvuitton.com', 'client-perso.louisvuitton.com',
  'cloud.client.louisvuitton.com', 'connect-dev-linestudio.louisvuitton.com', 'connect-int-linestudio.louisvuitton.com',
  'connect-org-dev-linestudio.louisvuitton.com', 'connect-org-int-linestudio.louisvuitton.com',
  'connect-org-prd-linestudio.louisvuitton.com', 'connect-org-prp-linestudio.louisvuitton.com',
  'connect-prd-linestudio.louisvuitton.com', 'connect-prp-linestudio.louisvuitton.com',
  'content-linestudio-int.louisvuitton.com', 'content-linestudio-prd.louisvuitton.com',
  'content-linestudio-prp.louisvuitton.com', 'contents-int.louisvuitton.com', 'contents-prp.louisvuitton.com',
  'contents.louisvuitton.com', 'culture.louisvuitton.com', 'data-aka-prp.cityguide.louisvuitton.com',
  'data-aka-prp.grandpalais.louisvuitton.com', 'data-aka-prp.piis.louisvuitton.com',
  'data-aka.cityguide.louisvuitton.com', 'data-aka.grandpalais.louisvuitton.com', 'data-aka.piis.louisvuitton.com',
  'de-i3f.louisvuitton.com', 'de-ppt.louisvuitton.com', 'dev.eu-api.louisvuitton.com',
  'en-i3f.louisvuitton.com', 'en-ppt.louisvuitton.com', 'endlessrun.louisvuitton.com',
  'epv3-fota.louisvuitton.com', 'es-i3f.louisvuitton.com', 'es-ppt.louisvuitton.com',
  'eu-api.louisvuitton.com', 'eu-i3f.louisvuitton.com', 'eu-ppt.louisvuitton.com',
  'fi-ppt.louisvuitton.com', 'fr-i3f.louisvuitton.com', 'fr-ppt.louisvuitton.com',
  'happyholidays.louisvuitton.com', 'hk-i3f.louisvuitton.com', 'hk-ppt.louisvuitton.com',
  'horizon.louisvuitton.com', 'hotspot-prp.louisvuitton.com', 'hotspot.louisvuitton.com',
  'hwperso-prp.louisvuitton.com', 'hwperso.louisvuitton.com', 'icon.louisvuitton.com',
  'id-ppt.louisvuitton.com', 'ie-ppt.louisvuitton.com', 'image.client-prp.louisvuitton.com',
  'image.client.louisvuitton.com', 'img.communication.louisvuitton.com', 'in-ppt.louisvuitton.com',
  'indus-learning-app-prp.louisvuitton.com', 'indus-learning-app.louisvuitton.com',
  'int-lv-configurator-api.louisvuitton.com', 'int.as-api.louisvuitton.com', 'int.eu-api.louisvuitton.com',
  'int.us-api.louisvuitton.com', 'int2.eu-api.louisvuitton.com', 'int3.eu-api.louisvuitton.com',
  'int4.eu-api.louisvuitton.com', 'int5.eu-api.louisvuitton.com', 'int6.eu-api.louisvuitton.com',
  'internalevents.louisvuitton.com', 'iot-dev.louisvuitton.com', 'iot-prp.louisvuitton.com',
  'iot.louisvuitton.com', 'it-i3f.louisvuitton.com', 'it-ppt.louisvuitton.com',
  'jobs.louisvuitton.com', 'journey-client-form.louisvuitton.com', 'jp-i3f.louisvuitton.com',
  'jp-ppt.louisvuitton.com', 'kr-i3f.louisvuitton.com', 'kr-ppt.louisvuitton.com',
  'la-ppt.louisvuitton.com', 'learning-preview.louisvuitton.com', 'learning-prp.louisvuitton.com',
  'learning.louisvuitton.com', 'link.louisvuitton.com', 'liveplayer.louisvuitton.com',
  'livetour.louisvuitton.com', 'look.louisvuitton.com', 'louisworldays2024.louisvuitton.com',
  'lu-ppt.louisvuitton.com', 'lv-cityguide-ws.louisvuitton.com', 'lv-iot-services-ncc-dev.louisvuitton.com',
  'lv-iot-services-ncc-prp.louisvuitton.com', 'lv-iot-services-ncc.louisvuitton.com',
  'lv-iot-services-prp.louisvuitton.com', 'lv-iot-services.louisvuitton.com', 'lvconnect-prp.louisvuitton.com',
  'lvconnect.louisvuitton.com', 'lvcontrol-tower.louisvuitton.com', 'lvme-prp.louisvuitton.com',
  'lvme.louisvuitton.com', 'lvtk-prp.louisvuitton.com', 'lvtk.louisvuitton.com',
  'lvtl.louisvuitton.com', 'makeityours-prp.louisvuitton.com', 'mc-ppt.louisvuitton.com',
  'me-ppt.louisvuitton.com', 'men-by-virgil-abloh.louisvuitton.com', 'monogramboy.louisvuitton.com',
  'moodboard-prp.louisvuitton.com', 'moodboard.louisvuitton.com', 'mosaic.louisvuitton.com',
  'murakami.louisvuitton.com', 'my-ppt.louisvuitton.com', 'mycc.louisvuitton.com',
  'mylvempreinte.louisvuitton.com', 'myreport-prp.louisvuitton.com', 'myreport.louisvuitton.com',
  'ndam-publish-int.louisvuitton.com', 'ndam-publish-prp.louisvuitton.com', 'ndam-publish.louisvuitton.com',
  'nl-ppt.louisvuitton.com', 'nowyours.louisvuitton.com', 'nz-ppt.louisvuitton.com',
  'okta.louisvuitton.com', 'org-b2c-as-tqf.louisvuitton.com', 'org-b2c-as.louisvuitton.com',
  'org-b2c-prw.louisvuitton.com', 'org-b2c-t1p.louisvuitton.com', 'org-b2c-tpt.louisvuitton.com',
  'org-b2c-tqf.louisvuitton.com', 'org-b2c-tqt.louisvuitton.com', 'org-b2c-us-tqf.louisvuitton.com',
  'org-b2c-us.louisvuitton.com', 'org-b2c.louisvuitton.com', 'org-catalog-wecom-prp.louisvuitton.com',
  'org-catalog-wecom.louisvuitton.com', 'org-client-perso.louisvuitton.com', 'org-content-linestudio-int.louisvuitton.com',
  'org-content-linestudio-prp.louisvuitton.com', 'org-front-2.louisvuitton.com', 'org-front-hidden-tqt.louisvuitton.com',
  'org-front-hidden.louisvuitton.com', 'org-front-t1f.louisvuitton.com', 'org-front-t1i.louisvuitton.com',
  'org-front-t2f.louisvuitton.com', 'org-front-t2i.louisvuitton.com', 'org-front-t3f.louisvuitton.com',
  'org-front-t3i.louisvuitton.com', 'org-front-t4f.louisvuitton.com', 'org-front-t4i.louisvuitton.com',
  'org-front-t5i.louisvuitton.com', 'org-front-t6i.louisvuitton.com', 'org-front-tqt-2.louisvuitton.com',
  'org-front-tqt.louisvuitton.com', 'org-front.louisvuitton.com', 'org-int-client-perso.louisvuitton.com',
  'org-int-product-perso-public.louisvuitton.com', 'org-int-remote-configurator.louisvuitton.com',
  'org-int-remote-product-perso.louisvuitton.com', 'org-lvconnect-prp.louisvuitton.com', 'org-lvconnect.louisvuitton.com',
  'org-lvtl-dev.louisvuitton.com', 'org-lvtl-prp.louisvuitton.com', 'org-lvtl.louisvuitton.com',
  'org-product-perso-public.louisvuitton.com', 'org-prp-client-perso.louisvuitton.com',
  'org-prp-product-perso-public.louisvuitton.com', 'org-prp-remote-configurator.louisvuitton.com',
  'org-prp-remote-product-perso.louisvuitton.com', 'org-prw-front-t1f.louisvuitton.com',
  'org-prw-front-t2f.louisvuitton.com', 'org-prw-front-t3f.louisvuitton.com', 'org-prw-front-tqt.louisvuitton.com',
  'org-remote-configurator.louisvuitton.com', 'org-remote-product-perso.louisvuitton.com',
  'org-stg.louisvuitton.com', 'org-www.louisvuitton.com', 'origin-poc.louisvuitton.com',
  'pages.client.louisvuitton.com', 'pass-api.louisvuitton.com', 'pass-prp.louisvuitton.com',
  'pass-rocket-control-dev.louisvuitton.com', 'pass.louisvuitton.com', 'perf.eu-api.louisvuitton.com',
  'player.louisvuitton.com', 'press.louisvuitton.com', 'preview-lvtl.louisvuitton.com',
  'preview-org-lvtl-dev.louisvuitton.com', 'preview-org-lvtl-prp.louisvuitton.com',
  'preview-org-lvtl.louisvuitton.com', 'productsvisualsearch.louisvuitton.com',
  'prp-lv-configurator-api.louisvuitton.com', 'prp.as-api.louisvuitton.com', 'prp.eu-api.louisvuitton.com',
  'prp.us-api.louisvuitton.com', 'prp2.eu-api.louisvuitton.com', 'prp3.eu-api.louisvuitton.com',
  'qa.louisvuitton.com', 'queue-ppf.louisvuitton.com', 'r.communication.louisvuitton.com',
  'redirect.louisvuitton.com', 'retail-learning-app-prp.louisvuitton.com', 'retail-learning-app.louisvuitton.com',
  'ru-i3f.louisvuitton.com', 'ru-ppt.louisvuitton.com', 'secure-i3f.louisvuitton.com',
  'secure-ppt.louisvuitton.com', 'secure.louisvuitton.com', 'services-prp.louisvuitton.com',
  'services.louisvuitton.com', 'sg-ppt.louisvuitton.com', 'skylims-prp.louisvuitton.com',
  'stellar-assets-prp.louisvuitton.com', 'stellar-assets.louisvuitton.com', 'supply-static-anpl.louisvuitton.com',
  'survey-dev-linestudio.louisvuitton.com', 'survey-int-linestudio.louisvuitton.com',
  'survey-org-dev-linestudio.louisvuitton.com', 'survey-org-int-linestudio.louisvuitton.com',
  'survey-org-prd-linestudio.louisvuitton.com', 'survey-org-prp-linestudio.louisvuitton.com',
  'survey-prd-linestudio.louisvuitton.com', 'survey-prp-linestudio.louisvuitton.com',
  'survey.louisvuitton.com', 'sustainability.louisvuitton.com', 'th-ppt.louisvuitton.com',
  'thfota.louisvuitton.com', 'thfotadownload.louisvuitton.com', 'ticketing-la-galerie.louisvuitton.com',
  'ticketing.louisvuitton.com', 'tp.louisvuitton.com', 'tp5.louisvuitton.com',
  'tracker-prp.piis.louisvuitton.com', 'tracker.piis.louisvuitton.com', 'tracking-me.louisvuitton.com',
  'tw-i3f.louisvuitton.com', 'tw-ppt.louisvuitton.com', 'uk-i3f.louisvuitton.com',
  'uk-ppt.louisvuitton.com', 'unlockoperations.louisvuitton.com', 'us-api.louisvuitton.com',
  'us-i3f.louisvuitton.com', 'us-ppt.louisvuitton.com', 'vdp.louisvuitton.com',
  'videocall-dp.louisvuitton.com', 'videocall.louisvuitton.com', 'view.client.louisvuitton.com',
  'vip-shop.louisvuitton.com', 'virtualjourney-sa.louisvuitton.com', 'virtualjourney.louisvuitton.com',
  'vn-ppt.louisvuitton.com', 'vpsummer.louisvuitton.com', 'vvv-nyc.louisvuitton.com',
  'vvv-seoul-int.louisvuitton.com', 'vvv-seoul-prp.louisvuitton.com', 'vvv-seoul.louisvuitton.com',
  'wait.louisvuitton.com', 'wardrobing.louisvuitton.com', 'webapp.louisworldays2024.louisvuitton.com',
  'www-i3f.louisvuitton.com', 'www-ppt.louisvuitton.com', 'www.louisvuitton.com',
  'yayoikusama.louisvuitton.com'
]


const CANON_LOCALES = LOCALES
const USER_LOCALES = []
const LOCALE_ALIASES = {}
const ALL_LOCALES = Array.from(new Set([...CANON_LOCALES, ...USER_LOCALES.map(l => LOCALE_ALIASES[l] || l)]))

// Normalize duplicate-y CDN query params for dedup
const STRIP_QUERY_PARAMS = new Set(['wid', 'hei', 'width', 'height', 'fmt', 'format', 'qlt', 'quality', 'op_sharpen', 'bg', 'bgc', 'resmode'])

// Global HTTP agent: keep-alive + pipelining
setGlobalDispatcher(new Agent({
  connections: CONCURRENCY * 2,
  pipelining: 2,
  keepAliveTimeout: 15_000,
  headersTimeout: REQUEST_TIMEOUT_MS + 2000
}))

/* ============================================================
   HELPERS
   ============================================================ */
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, trimValues: true, allowBooleanAttributes: true })
const seedSitemaps = SUBDOMAINS.flatMap(sub => LOCALES.map(locale => `https://${sub}.louisvuitton.com/content/louisvuitton/sitemap/${locale}/sitemap-image.xml`))

function hostOf(u) { try { return new URL(u).host } catch { return '' } }
function localeOf(u) { try { return new URL(u).pathname.match(/\/sitemap\/([^/]+)\/sitemap-image\.xml$/i)?.[1] ?? '' } catch { return '' } }
function normalizeImageUrl(u) {
  try {
    const url = new URL(u)
    for (const k of Array.from(url.searchParams.keys())) if (STRIP_QUERY_PARAMS.has(k)) url.searchParams.delete(k)
    url.pathname = url.pathname.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch { return u }
}
function makeId(src) {
  const h = createHash('sha1'); h.update(String(src || '')); return h.digest('hex').slice(0, 16)
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
function jitter(n) { return n * (0.75 + Math.random() * 0.5) }

async function fetchWithRetry(url, opts = {}) {
  let attempt = 0
  while (true) {
    attempt++
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        ...opts,
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          'accept': 'application/xml,text/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.8',
          ...(opts.headers || {})
        }
      })
      clearTimeout(timer)
      if (!res.ok) {
        if ((res.status >= 500 || res.status === 429) && attempt <= MAX_RETRIES) {
          await sleep(jitter(RETRY_BASE_MS * attempt)); continue
        }
        throw new Error(`HTTP ${res.status}`)
      }
      return res
    } catch (e) {
      clearTimeout(timer)
      const transient = e && (e.name === 'AbortError' || e.message?.includes('network'))
      if (transient && attempt <= MAX_RETRIES) { await sleep(jitter(RETRY_BASE_MS * attempt)); continue }
      throw e instanceof Error ? e : new Error(String(e))
    }
  }
}

async function fetchText(url, allowed = [200]) {
  try {
    const res = await fetchWithRetry(url)
    if (!allowed.includes(res.status)) return null
    return await res.text()
  } catch { return null }
}

function parseRobotsForSitemaps(text) {
  if (!text) return []
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^[\s]*sitemap:\s*(\S+)/i)
    if (m) {
      try {
        const u = new URL(m[1])
        if (u.host.endsWith('louisvuitton.com')) out.push(u.toString())
      } catch { /* ignore */ }
    }
  }
  return out
}
function parseSitemapIndex(xml) {
  try {
    const p = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true })
    const obj = p.parse(xml)
    const idx = obj.sitemapindex
    const arr = Array.isArray(idx?.sitemap) ? idx.sitemap : idx?.sitemap ? [idx.sitemap] : []
    return arr.map(it => it.loc).filter(Boolean)
  } catch { return [] }
}
function urlsetHasImages(xml) {
  return !!xml && /<urlset[\s\S]*?<image:/i.test(xml)
}
function normalizeLocaleInUrl(u) {
  try {
    const url = new URL(u)
    const m = url.pathname.match(/\/sitemap\/([a-z]{3}_[A-Z]{2})\//)
    if (m) {
      const loc = m[1]; const mapped = LOCALE_ALIASES[loc] || loc
      if (mapped !== loc) {
        url.pathname = url.pathname.replace(`/sitemap/${loc}/`, `/sitemap/${mapped}/`)
        return url.toString()
      }
    }
  } catch { }
  return u
}

async function discoverForHost(host) {
  const discovered = new Set()

  const robots = await fetchText(`https://${host}/robots.txt`, [200, 404])
  const robotsSitemaps = parseRobotsForSitemaps(robots).map(normalizeLocaleInUrl)

  const topXml = await fetchText(`https://${host}/sitemap.xml`, [200, 404])
  let topSitemaps = []
  if (topXml) {
    if (/<sitemapindex/i.test(topXml)) {
      topSitemaps = parseSitemapIndex(topXml).map(normalizeLocaleInUrl)
    } else {
      topSitemaps = [`https://${host}/sitemap.xml`]
    }
  }

  const candidates = [...robotsSitemaps, ...topSitemaps].filter(Boolean)
  for (const u of candidates) {
    const xml = await fetchText(u, [200, 404])
    if (!xml) continue
    if (/\/sitemap\w*\.xml$/i.test(u) && /<sitemapindex/i.test(xml)) {
      const children = parseSitemapIndex(xml).map(normalizeLocaleInUrl)
      for (const child of children) {
        const cxml = await fetchText(child, [200, 404])
        if (cxml && urlsetHasImages(cxml)) discovered.add(child)
      }
    } else {
      if (urlsetHasImages(xml)) discovered.add(u)
    }
  }

  // Fallback pattern across locales
  for (const loc of ALL_LOCALES) {
    const u = `https://${host}/content/louisvuitton/sitemap/${loc}/sitemap-image.xml`
    if (discovered.has(u)) continue
    const xml = await fetchText(u, [200, 404])
    if (xml && urlsetHasImages(xml)) discovered.add(u)
  }

  return Array.from(discovered)
}

async function pooledMap(items, fn, concurrency = 6) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (true) {
      const idx = i++; if (idx >= items.length) break
      try { out[idx] = await fn(items[idx], idx) } catch { out[idx] = [] }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

function* iterSitemapItems(xmlText) {
  const root = parser.parse(xmlText)
  const urlset = root.urlset || root.sitemapindex || root
  const urls = Array.isArray(urlset.url) ? urlset.url : urlset.url ? [urlset.url] : []
  for (const entry of urls) {
    const pageUrl = entry?.loc || ''
    let images = entry?.image || entry?.['image:image'] || []
    if (!Array.isArray(images)) images = [images]
    for (const image of images) {
      if (!image) continue
      const raw = image.loc || image['image:loc'] || image.url || null
      if (!raw) continue
      const src = normalizeImageUrl(raw)
      const title = image.title || image['image:title'] || image.caption || image['image:caption'] || ''
      const license = image.license || image['image:license'] || ''
      yield { src, title, license, pageUrl }
    }
  }
}

/* ============================================================
   MAIN (Discovery → Crawl → Streamed JSON)
   ============================================================ */
async function main() {
  console.log(`Fetching image sitemaps… (discovery=${ENABLE_DISCOVERY ? 'on' : 'off'})`)
  await mkdir(generatedDir, { recursive: true })

  // 1) Build sitemap list (seed ∪ discovered)
  let sitemapSet = new Set(seedSitemaps)
  if (ENABLE_DISCOVERY) {
    console.log(`→ Starting discovery across ${CANDIDATE_HOSTS.length} hosts …`)
    const batchSize = 8
    for (let off = 0; off < CANDIDATE_HOSTS.length; off += batchSize) {
      const batch = CANDIDATE_HOSTS.slice(off, off + batchSize)
      process.stdout.write(`   • batch ${Math.floor(off / batchSize) + 1}/${Math.ceil(CANDIDATE_HOSTS.length / batchSize)}: ${batch.join(', ')}\n`)
      const lists = await pooledMap(batch, discoverForHost, 4)
      for (const list of lists) for (const u of list) sitemapSet.add(u)
      if (off + batchSize < CANDIDATE_HOSTS.length) await sleep(500)
    }
  }
  const SITEMAP_URLS = Array.from(sitemapSet).sort()
  console.log(`→ Sitemap list ready: ${SITEMAP_URLS.length} candidates`)

  // 2) Open streamed output
  const out = createWriteStream(datasetPath, { flags: 'w' })
  const write = (s) => new Promise((res, rej) => out.write(s, err => err ? rej(err) : res()))
  await write('{\n')
  await write(`  "version": 3,\n`)
  await write(`  "generatedAt": "${new Date().toISOString()}",\n`)
  await write(`  "config": ${JSON.stringify({ discovery: ENABLE_DISCOVERY, concurrency: CONCURRENCY })},\n`)
  await write(`  "items": [\n`)

  // 3) Crawl with bounded parallelism; stream items; keep only small rollups in RAM
  const limit = pLimit(CONCURRENCY)
  const seen = new Set()
  const pagesSet = new Set()
  const localeCounts = new Map()
  const hostCounts = new Map()
  const sitemaps = []
  const failures = []
  let firstItem = true
  let emitted = 0
  let writesSinceFlush = 0

  function bump(map, key, n = 1) { if (key) map.set(key, (map.get(key) || 0) + n) }

  await Promise.all(
    SITEMAP_URLS.map(url =>
      limit(async () => {
        const meta = { url, host: hostOf(url), locale: localeOf(url) }
        try {
          const res = await fetchWithRetry(url)
          const xml = await res.text()

          let countThisMap = 0
          for (const it of iterSitemapItems(xml)) {
            if (it.pageUrl) pagesSet.add(it.pageUrl)
            bump(localeCounts, meta.locale)
            bump(hostCounts, meta.host)
            countThisMap++

            const key = makeId(it.src)
            if (seen.has(key)) continue
            seen.add(key)

            const record = { id: key, src: it.src, title: it.title || '', license: it.license || '' }
            const line = (firstItem ? '' : ',\n') + '    ' + JSON.stringify(record)
            await write(line)
            firstItem = false
            emitted++; writesSinceFlush++
            if (writesSinceFlush >= STREAM_FLUSH_EVERY) {
              await new Promise((res, rej) => out.flush?.() ? out.flush(err => err ? rej(err) : res()) : res())
              writesSinceFlush = 0
            }
          }

          sitemaps.push({ ...meta, ok: true, imageCount: countThisMap })
          process.stdout.write(`✓ ${url}  +${countThisMap} images\n`)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          sitemaps.push({ ...meta, ok: false, imageCount: 0, error: message })
          failures.push({ ...meta, error: message })
          process.stdout.write(`✗ ${url}  ${message}\n`)
        }
      })
    )
  )

  await write('\n  ],\n')

  const toObjectSorted = (m) =>
    Object.fromEntries([...m.entries()].sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1])))

  const totals = {
    images: emitted,
    pages: pagesSet.size,
    locales: toObjectSorted(localeCounts),
    hosts: toObjectSorted(hostCounts),
    sitemaps: sitemaps.length,
    ok: sitemaps.filter(s => s.ok).length,
    failures: failures.length
  }

  await write(`  "totals": ${JSON.stringify(totals, null, 2)},\n`)
  await write(`  "sitemaps": ${JSON.stringify(sitemaps.sort((a, b) => (a.locale || '').localeCompare(b.locale || '') || (a.host || '').localeCompare(b.host || '') || a.url.localeCompare(b.url)), null, 2)},\n`)
  await write(`  "failures": ${JSON.stringify(failures, null, 2)}\n`)
  await write('}\n')
  await new Promise((res, rej) => out.end(err => err ? rej(err) : res()))

  console.log(`\nSaved dataset → ${path.relative(process.cwd(), datasetPath)}`)
  console.log(`Images (unique): ${totals.images.toLocaleString()} • Unique pages: ${totals.pages.toLocaleString()} • OK: ${totals.ok}/${totals.sitemaps}`)
  if (failures.length) console.warn(`Failures: ${failures.length}`)
}

main().catch(err => { console.error(err); process.exitCode = 1 })
