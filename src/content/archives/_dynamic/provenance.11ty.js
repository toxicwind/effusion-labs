// Build a global provenance index by scanning products' provenance_ref JSONL files.
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const readJsonl = async abs => {
  try {
    const raw = await fsp.readFile(abs, 'utf8')
    return raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}
const hostname = (u = '') => {
  try {
    return new URL(u).hostname
  } catch {
    return ''
  }
}

export default async function (data = {}) {
  const collections = data?.collections || {}
  const archiveProducts = Array.isArray(collections.archiveProducts)
    ? collections.archiveProducts
    : []
  const provToProduct = new Map()
  for (const p of archiveProducts) {
    const ref = p?.data?.provenance_ref
    if (ref && typeof ref === 'string') {
      const rel = ref.startsWith('/') ? ref.slice(1) : ref
      const abs = path.join(ROOT, rel)
      provToProduct.set(path.resolve(abs), p.data)
    }
  }
  const hosts = new Map()
  const currencies = new Map()
  const markets = new Map()
  const products = new Map()
  const push = (m, k, init) => {
    if (!m.has(k)) m.set(k, typeof init === 'function' ? init() : (init ?? {}))
    return m.get(k)
  }

  for (const [absJsonl, pdata] of provToProduct.entries()) {
    const entries = await readJsonl(absJsonl)
    if (!entries.length) continue
    const ps = push(products, pdata.productSlug, () => ({
      entries: [],
      hosts: new Set(),
      currencies: new Set(),
      markets: new Set(),
      first: null,
      last: null,
      url: pdata.url,
      title: pdata.title || pdata.product_id || pdata.productSlug,
      companySlug: pdata.companySlug,
      lineSlug: pdata.lineSlug,
      charSlug: pdata.charSlug,
      seriesSlug: pdata.seriesSlug,
    }))
    for (const e of entries) {
      const h = hostname(e.url || e.source || '')
      const ccy = (e.currency || '').toString().trim().toUpperCase()
      const mkt = (e.market || e.region || '').toString().trim().toUpperCase()
      const price =
        typeof e.price === 'number' ? e.price : Number(e.price) || null
      const ts = e.retrieved_at || e.date || e.timestamp || null
      ps.entries.push({
        host: h,
        url: e.url || '',
        title: e.title || '',
        price,
        currency: ccy || null,
        market: mkt || null,
        retrieved_at: ts,
      })
      if (h) ps.hosts.add(h)
      if (ccy) ps.currencies.add(ccy)
      if (mkt) ps.markets.add(mkt)
      if (ts) {
        const t = new Date(ts).getTime()
        if (!Number.isNaN(t)) {
          if (!ps.first || t < ps.first) ps.first = t
          if (!ps.last || t > ps.last) ps.last = t
        }
      }
      if (h) {
        const hs = push(hosts, h, () => ({
          host: h,
          entries: 0,
          products: new Set(),
          first: null,
          last: null,
        }))
        hs.entries += 1
        hs.products.add(pdata.productSlug)
        if (ts) {
          const t = new Date(ts).getTime()
          if (!Number.isNaN(t)) {
            if (!hs.first || t < hs.first) hs.first = t
            if (!hs.last || t > hs.last) hs.last = t
          }
        }
      }
      if (ccy) {
        const cs = push(currencies, ccy, () => ({
          code: ccy,
          entries: 0,
          min: null,
          max: null,
          products: new Set(),
        }))
        cs.entries += 1
        cs.products.add(pdata.productSlug)
        if (typeof price === 'number') {
          if (cs.min == null || price < cs.min) cs.min = price
          if (cs.max == null || price > cs.max) cs.max = price
        }
      }
      if (mkt) {
        const ms = push(markets, mkt, () => ({
          code: mkt,
          entries: 0,
          products: new Set(),
        }))
        ms.entries += 1
        ms.products.add(pdata.productSlug)
      }
    }
  }
  const toArr = (m, cmp) => Array.from(m.values()).sort(cmp)
  const hostsArr = toArr(hosts, (a, b) => b.entries - a.entries)
  hostsArr.forEach(h => (h.products = Array.from(h.products)))
  const currenciesArr = toArr(currencies, (a, b) => b.entries - a.entries)
  currenciesArr.forEach(c => (c.products = Array.from(c.products)))
  const marketsArr = toArr(markets, (a, b) => b.entries - a.entries)
  marketsArr.forEach(m => (m.products = Array.from(m.products)))
  const productsArr = Array.from(products.entries())
    .sort((a, b) => (b[1]?.entries.length ?? 0) - (a[1]?.entries.length ?? 0))
    .map(([slug, v]) => ({
      slug,
      ...v,
      hosts: Array.from(v.hosts),
      currencies: Array.from(v.currencies),
      markets: Array.from(v.markets),
    }))

  return {
    stats: {
      products: productsArr.length,
      hosts: hostsArr.length,
      currencies: currenciesArr.length,
      markets: marketsArr.length,
      entries: productsArr.reduce((n, p) => n + p.entries.length, 0),
    },
    hosts: hostsArr,
    currencies: currenciesArr,
    markets: marketsArr,
    products: productsArr,
    byProduct: Object.fromEntries(productsArr.map(p => [p.slug, p])),
  }
}
