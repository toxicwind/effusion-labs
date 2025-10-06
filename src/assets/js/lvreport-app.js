import Alpine from 'alpinejs'
import Fuse from 'fuse.js'
import MiniSearch from 'minisearch'

const datasetEl = document.getElementById('lvreport-data')
const payloadSource = (() => {
  if (!datasetEl) return null
  if (datasetEl.tagName === 'TEMPLATE') return datasetEl.innerHTML
  return datasetEl.textContent
})()
const payload = payloadSource ? JSON.parse(payloadSource) : {}
const baseHref = payload.baseHref || ''
const sections = payload.page?.sections || {}
const sectionKeys = Object.keys(sections)
const bakedInfo = payload.baked || {}
const emptyBannerEl = document.getElementById('lvreport-empty')

if (!sectionKeys.length && emptyBannerEl) {
  emptyBannerEl.hidden = false
}

const fuseConfigs = {
  sitemaps: { keys: ['host', 'url', 'type', 'status'], threshold: 0.35, ignoreLocation: true },
  robots: {
    keys: ['host', 'statusLabel', 'httpLabel', 'preview'],
    threshold: 0.35,
    ignoreLocation: true,
  },
  docs: {
    keys: ['host', 'fileName', 'statusLabel', 'contentType', 'preview'],
    threshold: 0.3,
    ignoreLocation: true,
  },
  duplicates: { keys: ['basename', 'title', 'pageUrl'], threshold: 0.3, ignoreLocation: true },
  topProducts: { keys: ['title', 'pageUrl'], threshold: 0.3, ignoreLocation: true },
  hosts: { keys: ['host'], threshold: 0.2, ignoreLocation: true },
}

const fuseInstances = new Map()
const filters = {}
const sectionControllers = new Map()

const LAZY_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
const toneBadge = {
  error: 'badge-error',
  warn: 'badge-warning',
  ok: 'badge-success',
  info: 'badge-info',
}

const lazyQueue = []
let activeLazyLoads = 0
const MAX_LAZY_CONCURRENCY = 4

function ensureArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function ensureAbsoluteUrl(url, { assumeHttps = true } = {}) {
  if (!url) return ''
  if (/^https?:/i.test(url)) return url
  if (url.startsWith('//')) return `${assumeHttps ? 'https:' : 'http:'}${url}`
  if (url.startsWith('/')) return url
  return assumeHttps ? `https://${url}` : url
}

function createElement(tag, options = {}, children = []) {
  const config = options || {}
  const el = document.createElement(tag)
  if (config.className) el.className = config.className
  if (config.attrs) {
    for (const [attr, value] of Object.entries(options.attrs)) {
      if (value == null) continue
      el.setAttribute(attr, value)
    }
  }
  if (config.text != null) {
    el.textContent = config.text
  }
  appendChildren(el, children)
  return el
}

function appendChildren(target, children) {
  if (!children) return target
  const list = Array.isArray(children) ? children : [children]
  for (const child of list) {
    if (child == null) continue
    if (typeof child === 'string' || typeof child === 'number') {
      target.appendChild(document.createTextNode(String(child)))
    } else {
      target.appendChild(child)
    }
  }
  return target
}

function createLink(text, href, className = 'link', { external = true } = {}) {
  if (!href) return null
  const anchor = document.createElement('a')
  anchor.className = className
  anchor.href = href
  if (external) {
    anchor.target = '_blank'
    anchor.rel = 'noreferrer'
  }
  anchor.textContent = text
  return anchor
}

function createBadge(text, className) {
  return createElement('span', { className: `badge ${className}`.trim(), text })
}

function loadImage(src, srcset) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (srcset) img.srcset = srcset
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function processLazyQueue() {
  if (!lazyQueue.length || activeLazyLoads >= MAX_LAZY_CONCURRENCY) return
  const entry = lazyQueue.shift()
  if (!entry || entry.img.dataset.lazyLoaded === 'true') {
    processLazyQueue()
    return
  }
  activeLazyLoads++
  loadImage(entry.src, entry.srcset)
    .then(() => {
      entry.img.src = entry.src
      if (entry.srcset) entry.img.srcset = entry.srcset
      entry.img.dataset.lazyLoaded = 'true'
      entry.img.classList.add('lazy-loaded')
    })
    .catch(() => {
      entry.img.dataset.lazyError = 'true'
    })
    .finally(() => {
      activeLazyLoads = Math.max(0, activeLazyLoads - 1)
      processLazyQueue()
    })
}

function enqueueLazyImage(img) {
  const src = img.dataset.lazySrc
  if (!src || img.dataset.lazyLoaded === 'true') return
  if (!img.getAttribute('src')) {
    img.setAttribute('src', LAZY_PLACEHOLDER)
  }
  lazyQueue.push({ img, src, srcset: img.dataset.lazySrcset || null })
  processLazyQueue()
}

const lazyObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        lazyObserver.unobserve(entry.target)
        enqueueLazyImage(entry.target)
      }
    })
  }, { rootMargin: '200px 0px' })
  : null

function registerLazyImages(root = document) {
  const scope = root instanceof Element ? root : document
  const images = scope.querySelectorAll('[data-lazy-src]')
  images.forEach((img) => {
    if (img.dataset.lazyReady === 'true') return
    img.dataset.lazyReady = 'true'
    if (!img.getAttribute('src')) {
      img.setAttribute('src', LAZY_PLACEHOLDER)
    }
    if (lazyObserver) lazyObserver.observe(img)
    else enqueueLazyImage(img)
  })
}

function buildFuse(section) {
  const state = filters[section]
  if (!state) return
  const items = Array.isArray(state.source) ? state.source : []
  const config = fuseConfigs[section]
  if (!config || !items.length) {
    fuseInstances.delete(section)
    return
  }
  fuseInstances.set(section, new Fuse(items, { includeScore: true, ...config }))
}

function initFuseEngines() {
  for (const key of sectionKeys) {
    buildFuse(key)
  }
}

function updateSummary(section, { total, visible, from, to, page, pageCount }) {
  const el = document.querySelector(`[data-filter-summary="${section}"]`)
  if (!el) return
  const label = el.dataset.summaryLabel || section
  if (!total) {
    el.textContent = `No ${label}`
    return
  }
  const rangeText = from && to ? `${from}–${to}` : '0'
  let message = `Showing ${rangeText} of ${total} ${label}`
  if (visible != null && visible !== total) {
    message += ` • Filtered ${visible} of ${total}`
  }
  if (pageCount && pageCount > 1) {
    message += ` (page ${page} of ${pageCount})`
  }
  el.textContent = message
}

function updatePaginationControls(section, { page, pageCount }) {
  const controller = sectionControllers.get(section)
  if (!controller) return
  const { indicator, prev, next } = controller.elements
  if (indicator) {
    indicator.textContent = pageCount > 1 ? `Page ${page} of ${pageCount}` : `Page ${page}`
  }
  if (prev) {
    prev.disabled = page <= 1
  }
  if (next) {
    next.disabled = page >= pageCount
  }
}

const tableRenderers = {
  sitemaps: renderSitemapsRow,
  robots: renderRobotsRow,
  docs: renderDocsRow,
  duplicates: renderDuplicatesRow,
  topProducts: renderTopProductsRow,
  hosts: renderHostsRow,
}

function renderSectionRow(section, item) {
  const renderer = tableRenderers[section]
  if (renderer) return renderer(item)
  const tr = createElement('tr', {
    attrs: { 'data-section-row': section, 'data-entry-id': item?.id || '' },
  })
  tr.append(createElement('td', { text: JSON.stringify(item ?? {}) }))
  return tr
}

function renderSitemapsRow(item = {}) {
  const tr = createElement('tr', {
    attrs: { 'data-section-row': 'sitemaps', 'data-entry-id': item.id || '' },
  })
  if (item.type) tr.dataset.type = item.type
  const hostCell = createElement('td', { className: 'font-medium' })
  if (item.host) {
    hostCell.append(
      createLink(item.host, ensureAbsoluteUrl(item.host), 'link link-hover font-medium'),
    )
  } else {
    hostCell.textContent = '—'
  }
  tr.append(hostCell)
  tr.append(createElement('td', {}, createBadge(item.type || 'other', 'badge-outline capitalize')))
  tr.append(createElement('td', { text: String(item.imageCount ?? 0) }))
  tr.append(createElement('td', { text: item.status || '—' }))
  const liveCell = createElement('td')
  if (item.url) liveCell.append(createLink(item.url, item.url, 'link link-primary'))
  else liveCell.textContent = '—'
  tr.append(liveCell)
  const cacheCell = createElement('td')
  if (item.savedPath) cacheCell.append(createLink('open', `${baseHref}${item.savedPath}`, 'link'))
  else cacheCell.textContent = '—'
  tr.append(cacheCell)
  return tr
}

function renderRobotsRow(item = {}) {
  const tr = createElement('tr', {
    attrs: { 'data-section-row': 'robots', 'data-entry-id': item.id || '' },
  })
  tr.dataset.host = item.host || ''
  tr.dataset.status = item.statusCategory || ''
  tr.dataset.issue = item.isIssue ? '1' : '0'

  const hostCell = createElement('td', { className: 'align-top' })
  const hostStack = createElement('div', { className: 'flex flex-col gap-1' })
  if (item.host) {
    hostStack.append(
      createLink(item.host, ensureAbsoluteUrl(item.host), 'link link-hover font-medium'),
    )
  } else {
    hostStack.append(createElement('span', { className: 'font-medium', text: '—' }))
  }
  const actionRow = createElement('div', { className: 'flex flex-wrap items-center gap-2 text-xs' })
  if (item.host) {
    actionRow.append(
      createLink('Live robots.txt', `https://${item.host}/robots.txt`, 'link link-primary'),
    )
  }
  if (item.robotsTxtPath) {
    actionRow.append(createElement('span', { className: 'opacity-40', text: '·' }))
    actionRow.append(createLink('Cached', `${baseHref}${item.robotsTxtPath}`, 'link'))
  }
  if (item.blacklisted) {
    const reason = item.blacklistReason ? `Blacklisted · ${item.blacklistReason}` : 'Blacklisted'
    actionRow.append(
      createElement('span', { className: 'badge badge-error badge-outline', text: reason }),
    )
  }
  hostStack.append(actionRow)
  if (item.blacklisted && item.blacklistUntil) {
    hostStack.append(
      createElement('span', {
        className: 'text-[11px] opacity-60',
        text: `Active until ${item.blacklistUntil}`,
      }),
    )
  }
  hostCell.append(hostStack)
  tr.append(hostCell)

  const statusCell = createElement('td', { className: 'align-top' })
  const statusStack = createElement('div', { className: 'flex flex-col gap-1' })
  statusStack.append(
    createBadge(
      item.statusLabel || '',
      `${toneBadge[item.statusTone] || 'badge-outline'} badge-sm`,
    ),
  )
  if (item.httpLabel) statusStack.append(createBadge(item.httpLabel, 'badge-outline badge-xs'))
  statusStack.append(
    createElement('span', {
      className: 'text-[11px] opacity-60',
      text: `${item.linesTotal || 0} lines`,
    }),
  )
  statusCell.append(statusStack)
  tr.append(statusCell)

  const cacheCell = createElement('td', { className: 'align-top' })
  if (item.robotsTxtPath) {
    const stack = createElement('div', { className: 'flex flex-col gap-1 text-xs' })
    stack.append(
      createLink(
        item.fileName || 'robots.txt',
        `${baseHref}${item.robotsTxtPath}`,
        'link link-hover',
      ),
    )
    stack.append(
      createElement('span', { className: 'opacity-60', text: `${item.sizeLabel || ''} · cached` }),
    )
    cacheCell.append(stack)
  } else {
    cacheCell.append(createElement('span', { className: 'text-xs opacity-60', text: 'No cache' }))
  }
  tr.append(cacheCell)

  const directivesCell = createElement('td', { className: 'align-top' })
  const directivesBadges = createElement('div', { className: 'flex flex-wrap gap-1 text-[11px]' })
  const merged = item.parsed?.merged || {}
  const allowCount = ensureArray(merged.allow).length
  if (allowCount) {
    directivesBadges.append(createBadge(`Allow ${allowCount}`, 'badge-outline badge-xs'))
  }
  const disallowCount = ensureArray(merged.disallow).length
  if (disallowCount) {
    directivesBadges.append(createBadge(`Disallow ${disallowCount}`, 'badge-outline badge-xs'))
  }
  const noindexCount = ensureArray(merged.noindex).length
  if (noindexCount) {
    directivesBadges.append(createBadge(`Noindex ${noindexCount}`, 'badge-outline badge-xs'))
  }
  if (merged.crawlDelay != null && merged.crawlDelay !== '') {
    directivesBadges.append(createBadge(`Delay ${merged.crawlDelay}`, 'badge-outline badge-xs'))
  }
  const sitemapList = ensureArray(merged.sitemaps)
  if (sitemapList.length) {
    directivesBadges.append(createBadge(`Sitemaps ${sitemapList.length}`, 'badge-outline badge-xs'))
  }
  directivesCell.append(directivesBadges)
  if (sitemapList.length) {
    const sitemapWrap = createElement('div', { className: 'mt-1 space-y-1 text-[11px]' })
    sitemapList.slice(0, 3).forEach((url) => {
      sitemapWrap.append(createLink(url, url, 'link link-hover'))
    })
    if (sitemapList.length > 3) {
      sitemapWrap.append(
        createElement('span', {
          className: 'opacity-60',
          text: `+${sitemapList.length - 3} more…`,
        }),
      )
    }
    directivesCell.append(sitemapWrap)
  }
  const otherRules = item.parsed?.other || {}
  const otherKeys = Object.keys(otherRules)
  if (otherKeys.length) {
    const otherWrap = createElement('div', { className: 'mt-1 flex flex-wrap gap-1 text-[11px]' })
    otherKeys.forEach((key) => {
      const values = ensureArray(otherRules[key]).join(' · ')
      otherWrap.append(createBadge(`${key}: ${values}`, 'badge-outline badge-xs'))
    })
    directivesCell.append(otherWrap)
  }
  tr.append(directivesCell)

  const previewCell = createElement('td', { className: 'align-top w-80' })
  if (item.preview) {
    const pre = createElement('pre', {
      className:
        'bg-base-100 border border-base-content/10 rounded-box p-3 text-xs leading-5 whitespace-pre-wrap max-h-36 overflow-auto',
    })
    pre.textContent = item.preview
    previewCell.append(pre)
    if (item.robotsTxtPath) {
      previewCell.append(
        createLink('Open full raw', `${baseHref}${item.robotsTxtPath}`, 'link link-hover text-xs'),
      )
    }
  } else if (item.hasCached && item.robotsTxtPath) {
    previewCell.append(
      createLink('Open cached file', `${baseHref}${item.robotsTxtPath}`, 'link link-hover text-xs'),
    )
  } else {
    previewCell.append(
      createElement('span', { className: 'text-xs opacity-60', text: 'No cache captured' }),
    )
  }
  tr.append(previewCell)

  return tr
}

function renderDocsRow(item = {}) {
  const tr = createElement('tr', {
    attrs: { 'data-section-row': 'docs', 'data-entry-id': item.id || '' },
  })
  tr.dataset.status = item.statusCategory || ''
  tr.dataset.issue = item.isIssue ? '1' : '0'

  const hostCell = createElement('td', { className: 'align-top' })
  const hostStack = createElement('div', { className: 'flex flex-col gap-1' })
  if (item.host) {
    hostStack.append(
      createLink(item.host, ensureAbsoluteUrl(item.host), 'link link-hover font-medium'),
    )
  } else {
    hostStack.append(createElement('span', { className: 'font-medium', text: '—' }))
  }
  if (item.url) {
    hostStack.append(createLink('Live document', item.url, 'link link-primary text-xs'))
  }
  hostCell.append(hostStack)
  tr.append(hostCell)

  const fileCell = createElement('td', { className: 'align-top' })
  const fileStack = createElement('div', { className: 'flex flex-col gap-1 text-xs' })
  if (item.savedPath) {
    fileStack.append(
      createLink(
        item.fileName || 'cached document',
        `${baseHref}${item.savedPath}`,
        'link link-hover',
      ),
    )
    fileStack.append(createElement('span', { className: 'opacity-60', text: item.savedPath }))
  }
  fileStack.append(createBadge(item.kind || '—', 'badge-outline badge-xs capitalize'))
  fileCell.append(fileStack)
  tr.append(fileCell)

  const statusCell = createElement('td', { className: 'align-top' })
  const statusStack = createElement('div', { className: 'flex flex-col gap-1' })
  statusStack.append(
    createBadge(
      item.statusLabel || '',
      `${toneBadge[item.statusTone] || 'badge-outline'} badge-sm`,
    ),
  )
  if (item.httpLabel) statusStack.append(createBadge(item.httpLabel, 'badge-outline badge-xs'))
  if (item.status) {
    statusStack.append(
      createElement('span', {
        className: 'text-[11px] opacity-60',
        text: `Fetch status ${item.status}`,
      }),
    )
  }
  statusCell.append(statusStack)
  tr.append(statusCell)

  const metaCell = createElement('td', { className: 'align-top text-xs' })
  const metaStack = createElement('div', { className: 'space-y-1' })
  if (item.sizeLabel) {
    metaStack.append(createElement('span', { className: 'opacity-70', text: item.sizeLabel }))
  }
  if (item.contentType) {
    metaStack.append(createElement('span', { className: 'opacity-60', text: item.contentType }))
  }
  if (item.statusCategory === 'gzip') {
    metaStack.append(createElement('span', { className: 'opacity-60', text: 'Compressed (.gz)' }))
  }
  metaCell.append(metaStack)
  tr.append(metaCell)

  const previewCell = createElement('td', { className: 'align-top w-[360px]' })
  if (item.preview) {
    const pre = createElement('pre', {
      className:
        'bg-base-100 border border-base-content/10 rounded-box p-3 text-xs leading-5 whitespace-pre-wrap max-h-40 overflow-auto',
    })
    pre.textContent = item.preview
    previewCell.append(pre)
  } else if (item.statusCategory === 'gzip') {
    previewCell.append(
      createElement('span', {
        className: 'text-xs opacity-60',
        text: 'Gzip archive — download to inspect.',
      }),
    )
  } else {
    previewCell.append(
      createElement('span', { className: 'text-xs opacity-60', text: 'No preview available.' }),
    )
  }
  tr.append(previewCell)

  return tr
}

function renderDuplicatesRow(item = {}) {
  const tr = createElement('tr', {
    attrs: { 'data-section-row': 'duplicates', 'data-entry-id': item.id || '' },
  })
  const imageCell = createElement('td')
  if (item.src) {
    const link = createLink('', item.src, 'relative block')
    const img = createElement('img', {
      className: 'w-12 h-12 object-cover rounded-box border border-base-content/10',
      attrs: { src: LAZY_PLACEHOLDER, 'data-lazy-src': item.src, loading: 'lazy' },
    })
    link.append(img)
    imageCell.append(link)
  } else {
    imageCell.append(createElement('span', { className: 'text-xs opacity-60', text: 'No image' }))
  }
  tr.append(imageCell)
  tr.append(createElement('td', { text: String(Math.max(0, (item.count ?? 1) - 1)) }))
  tr.append(createElement('td', { text: item.basename || '' }))
  const pageCell = createElement('td')
  if (item.pageUrl) pageCell.append(createLink(item.pageUrl, item.pageUrl, 'link link-primary'))
  else pageCell.textContent = '—'
  tr.append(pageCell)
  tr.append(createElement('td', { text: item.firstSeen || '' }))
  tr.append(createElement('td', { text: item.lastSeen || '' }))
  return tr
}

function renderTopProductsRow(item = {}) {
  const tr = createElement('tr', {
    attrs: { 'data-section-row': 'topProducts', 'data-entry-id': item.id || '' },
  })
  const pageCell = createElement('td')
  if (item.pageUrl) {
    pageCell.append(createLink(item.title || item.pageUrl, item.pageUrl, 'link link-primary'))
  } else {
    pageCell.textContent = item.title || '—'
  }
  tr.append(pageCell)
  tr.append(createElement('td', { text: String(item.totalImages ?? 0) }))
  tr.append(createElement('td', { text: String(item.uniqueImages ?? 0) }))
  tr.append(createElement('td', { text: item.firstSeen || '' }))
  tr.append(createElement('td', { text: item.lastSeen || '' }))
  return tr
}

function renderHostsRow(item = {}) {
  const tr = createElement('tr', {
    attrs: { 'data-section-row': 'hosts', 'data-entry-id': item.id || '' },
  })
  const hostCell = createElement('td')
  if (item.host) {
    hostCell.append(createLink(item.host, ensureAbsoluteUrl(item.host), 'link link-hover'))
  } else {
    hostCell.textContent = '—'
  }
  tr.append(hostCell)
  tr.append(createElement('td', { text: String(item.images ?? 0) }))
  tr.append(createElement('td', { text: String(item.uniqueImages ?? 0) }))
  tr.append(createElement('td', { text: String(item.duplicates ?? 0) }))
  tr.append(createElement('td', { text: String(item.products ?? 0) }))
  tr.append(createElement('td', { text: String(item.pages ?? 0) }))
  return tr
}

function renderSectionPage(section) {
  const controller = sectionControllers.get(section)
  const state = filters[section]
  if (!controller || !state) return
  const items = Array.isArray(state.last) ? state.last : []
  const pageSize = Math.max(1, state.pageSize || 25)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  if (state.page > pageCount) state.page = pageCount
  if (state.page < 1) state.page = 1
  const start = (state.page - 1) * pageSize
  const pageItems = items.slice(start, start + pageSize)
  const { tbody, table } = controller.elements
  if (tbody) {
    tbody.innerHTML = ''
    if (pageItems.length) {
      const fragment = document.createDocumentFragment()
      for (const item of pageItems) {
        const row = renderSectionRow(section, item)
        if (row) fragment.append(row)
      }
      tbody.append(fragment)
    } else {
      const emptyRow = createElement('tr', { attrs: { 'data-empty-row': section } })
      const columnCount = table?.querySelectorAll('thead th').length || 1
      const cell = createElement('td', {
        className: 'text-center text-xs opacity-60',
        attrs: { colspan: String(columnCount) },
        text: `No ${section} entries match the current filters.`,
      })
      emptyRow.append(cell)
      tbody.append(emptyRow)
    }
    registerLazyImages(tbody)
  }
  const totalItems = state.total ?? state.source?.length ?? items.length
  updateSummary(section, {
    total: totalItems,
    visible: items.length,
    from: pageItems.length ? start + 1 : 0,
    to: pageItems.length ? start + pageItems.length : 0,
    page: state.page,
    pageCount,
  })
  updatePaginationControls(section, { page: state.page, pageCount })
}

function syncFilterChips(section, state) {
  if (section === 'sitemaps') {
    const chips = document.querySelectorAll(`[data-filter-chips="${section}"] [data-type]`)
    chips.forEach((btn) => {
      const type = btn.dataset.type || 'other'
      if (!state.types || state.types.has(type)) {
        btn.classList.add('btn-primary')
        btn.classList.remove('btn-outline')
      } else {
        btn.classList.add('btn-outline')
        btn.classList.remove('btn-primary')
      }
    })
  }
  if (section === 'robots' || section === 'docs') {
    const chips = document.querySelectorAll(`.status-chip[data-section="${section}"]`)
    chips.forEach((btn) => {
      const status = btn.dataset.status || ''
      if (!state.statuses || state.statuses.has(status)) btn.classList.add('btn-active')
      else btn.classList.remove('btn-active')
    })
  }
}

function applyFilters(section) {
  const state = filters[section]
  if (!state) return
  const items = Array.isArray(state.source) ? state.source : []
  let results = items

  const query = (state.query || '').trim()
  if (query) {
    const fuse = fuseInstances.get(section)
    if (fuse) {
      results = fuse.search(query).map((hit) => hit.item)
    } else {
      const lower = query.toLowerCase()
      results = items.filter((item) => JSON.stringify(item).toLowerCase().includes(lower))
    }
  }

  if (section === 'sitemaps' && state.types) {
    results = results.filter((item) => state.types.has(item.type || 'other'))
  }
  if ((section === 'robots' || section === 'docs') && state.statuses) {
    results = results.filter((item) => state.statuses.has(item.statusCategory || ''))
  }
  if ((section === 'robots' || section === 'docs') && state.issuesOnly) {
    results = results.filter((item) => item.isIssue)
  }

  state.last = results
  renderSectionPage(section)
}

function hookSearchInputs() {
  const inputs = document.querySelectorAll('[data-search-input]')
  inputs.forEach(input => {
    const section = input.dataset.searchInput
    if (!sectionKeys.includes(section)) return
    input.addEventListener('input', event => {
      const state = filters[section]
      if (!state) return
      state.query = event.target.value
      state.page = 1
      applyFilters(section)
    })
  })
}

function hookIssueToggles() {
  const toggles = document.querySelectorAll('[data-issues-toggle]')
  toggles.forEach(toggle => {
    const section = toggle.dataset.issuesToggle
    if (!sectionKeys.includes(section)) return
    toggle.addEventListener('change', () => {
      const state = filters[section]
      if (!state) return
      state.issuesOnly = toggle.checked
      state.page = 1
      applyFilters(section)
    })
  })
}

function hookStatusChips() {
  const chips = document.querySelectorAll('.status-chip[data-section][data-status]')
  chips.forEach(chip => {
    const section = chip.dataset.section
    if (!sectionKeys.includes(section)) return
    chip.addEventListener('click', () => {
      const status = chip.dataset.status
      const state = filters[section]
      if (!state || !state.statuses) return
      const set = state.statuses
      if (set.has(status)) {
        set.delete(status)
        chip.classList.remove('btn-active')
      } else {
        set.add(status)
        chip.classList.add('btn-active')
      }
      if (!set.size) {
        // ensure at least one status remains active
        const related = document.querySelectorAll(`.status-chip[data-section="${section}"]`)
        related.forEach(btn => {
          btn.classList.add('btn-active')
          set.add(btn.dataset.status)
        })
      }
      state.page = 1
      applyFilters(section)
    })
  })
}

function hookTypeChips() {
  const groups = document.querySelectorAll('[data-filter-chips]')
  groups.forEach(group => {
    const section = group.dataset.filterChips
    if (!sectionKeys.includes(section)) return
    group.querySelectorAll('[data-type]').forEach(button => {
      button.addEventListener('click', () => {
        const type = button.dataset.type || 'other'
        const state = filters[section]
        if (!state || !state.types) return
        const active = state.types
        if (active.has(type) && active.size > 1) {
          active.delete(type)
          button.classList.remove('btn-primary')
          button.classList.add('btn-outline')
        } else {
          active.add(type)
          button.classList.add('btn-primary')
          button.classList.remove('btn-outline')
        }
        state.page = 1
        applyFilters(section)
      })
    })
  })
}

function hookPaginationControls(sectionSubset = sectionKeys) {
  sectionSubset.forEach((section) => {
    const controller = sectionControllers.get(section)
    if (!controller || controller.bound) return
    const { pageSizeSelect, prev, next } = controller.elements
    const state = controller.state
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (event) => {
        const value = Number.parseInt(event.target.value, 10)
        if (!Number.isFinite(value) || value <= 0) return
        state.pageSize = value
        state.page = 1
        renderSectionPage(section)
      })
    }
    if (prev) {
      prev.addEventListener('click', () => {
        state.page = Math.max(1, (state.page || 1) - 1)
        renderSectionPage(section)
      })
    }
    if (next) {
      next.addEventListener('click', () => {
        const items = Array.isArray(state.last) ? state.last : []
        const pageSize = Math.max(1, state.pageSize || 25)
        const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
        state.page = Math.min(pageCount, (state.page || 1) + 1)
        renderSectionPage(section)
      })
    }
    controller.bound = true
  })
}

function csvEscape(value = '') {
  const str = String(value ?? '')
  const needsQuote = /[\n",]/.test(str)
  const escaped = str.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.append(link)
  link.click()
  setTimeout(() => {
    URL.revokeObjectURL(link.href)
    link.remove()
  }, 300)
}

const exportSchemas = {
  sitemaps: {
    name: 'lv-sitemaps.csv',
    headers: ['Host', 'Type', 'Images', 'Status', 'URL', 'Cached'],
    map: item => [
      item.host || '',
      item.type || '',
      item.imageCount ?? 0,
      item.status || '',
      item.url || '',
      item.savedPath ? `${baseHref}${item.savedPath}` : '',
    ],
  },
  robots: {
    name: 'lv-robots.csv',
    headers: ['Host', 'Status', 'HTTP', 'Cached', 'Preview'],
    map: item => [
      item.host || '',
      item.statusLabel || '',
      item.httpLabel || '',
      item.robotsTxtPath ? `${baseHref}${item.robotsTxtPath}` : '',
      (item.preview || '').replace(/\s+/g, ' ').slice(0, 180),
    ],
  },
  docs: {
    name: 'lv-documents.csv',
    headers: ['Host', 'File', 'Status', 'Content Type', 'Cached'],
    map: item => [
      item.host || '',
      item.fileName || '',
      item.statusLabel || '',
      item.contentType || '',
      item.savedPath ? `${baseHref}${item.savedPath}` : '',
    ],
  },
  duplicates: {
    name: 'lv-duplicates.csv',
    headers: ['Image', 'Duplicates', 'Basename', 'Page URL', 'First Seen', 'Last Seen'],
    map: item => [
      item.src || '',
      Math.max(0, (item.count || 1) - 1),
      item.basename || '',
      item.pageUrl || '',
      item.firstSeen || '',
      item.lastSeen || '',
    ],
  },
  topProducts: {
    name: 'lv-products.csv',
    headers: ['Title', 'Page URL', 'Total Images', 'Unique Images', 'First Seen', 'Last Seen'],
    map: item => [
      item.title || '',
      item.pageUrl || '',
      item.totalImages ?? 0,
      item.uniqueImages ?? 0,
      item.firstSeen || '',
      item.lastSeen || '',
    ],
  },
  hosts: {
    name: 'lv-hosts.csv',
    headers: ['Host', 'Images', 'Unique', 'Duplicates', 'Pages'],
    map: item => [
      item.host || '',
      item.images ?? 0,
      item.uniqueImages ?? 0,
      item.duplicates ?? 0,
      item.pages ?? 0,
    ],
  },
}

function hookExports() {
  const buttons = document.querySelectorAll('[data-export-section]')
  buttons.forEach(button => {
    const section = button.dataset.exportSection
    const schema = exportSchemas[section]
    if (!schema) return
    button.addEventListener('click', () => {
      const rows = [schema.headers]
      const items = filters[section]?.last || []
      if (!items.length) return
      items.forEach(item => rows.push(schema.map(item)))
      downloadCsv(schema.name, rows)
    })
  })
}

function ensureTypeAndStatusSets(section, state, items) {
  if (section === 'sitemaps') {
    const available = new Set(items.map((item) => item.type || 'other'))
    if (!state.types || !(state.types instanceof Set)) {
      state.types = available
    } else {
      const next = new Set()
      available.forEach((type) => {
        if (!state.types.size || state.types.has(type)) next.add(type)
      })
      if (!next.size) {
        available.forEach((type) => next.add(type))
      }
      state.types = next
    }
  }
  if (section === 'robots' || section === 'docs') {
    const available = new Set(
      items
        .map((item) => item.statusCategory || '')
        .filter((status) => Boolean(status)),
    )
    if (!available.size) {
      state.statuses = new Set()
      return
    }
    if (!state.statuses || !(state.statuses instanceof Set)) {
      state.statuses = available
    } else {
      const next = new Set()
      available.forEach((status) => {
        if (!state.statuses.size || state.statuses.has(status)) next.add(status)
      })
      if (!next.size) {
        available.forEach((status) => next.add(status))
      }
      state.statuses = next
    }
  }
}

function createSectionController(section, data) {
  const items = Array.isArray(data.items) ? data.items.slice() : []
  const totalItems = typeof data.totalItems === 'number' ? data.totalItems : items.length
  const pageSize = Math.max(1, data.size || 25)
  const state = {
    query: '',
    issuesOnly: false,
    types: null,
    statuses: null,
    source: items,
    last: items,
    total: totalItems,
    page: 1,
    pageSize,
  }
  ensureTypeAndStatusSets(section, state, items)
  filters[section] = state
  const controller = {
    state,
    elements: {
      table: document.querySelector(`[data-section-table="${section}"]`),
      tbody: document.querySelector(`[data-section-body="${section}"]`),
      summary: document.querySelector(`[data-filter-summary="${section}"]`),
      pageSizeSelect: document.querySelector(`[data-page-size="${section}"]`),
      indicator: document.querySelector(`[data-page-indicator="${section}"]`),
      prev: document.querySelector(`[data-page-prev="${section}"]`),
      next: document.querySelector(`[data-page-next="${section}"]`),
    },
  }
  sectionControllers.set(section, controller)
  if (controller.elements.pageSizeSelect) {
    controller.elements.pageSizeSelect.value = String(state.pageSize)
  }
  syncFilterChips(section, state)
  buildFuse(section)
  renderSectionPage(section)
}

function refreshSection(section, data) {
  if (!sectionControllers.has(section)) {
    createSectionController(section, data)
    hookPaginationControls([section])
    return
  }
  const controller = sectionControllers.get(section)
  const state = controller.state
  const items = Array.isArray(data.items) ? data.items.slice() : []
  state.source = items
  state.last = items
  state.total = typeof data.totalItems === 'number' ? data.totalItems : items.length
  if (Number.isFinite(data.size) && data.size > 0) {
    state.pageSize = Math.max(1, data.size)
  }
  state.page = 1
  ensureTypeAndStatusSets(section, state, items)
  if (controller.elements.pageSizeSelect) {
    controller.elements.pageSizeSelect.value = String(state.pageSize)
  }
  syncFilterChips(section, state)
  buildFuse(section)
  renderSectionPage(section)
}

function initialiseFilters() {
  for (const key of sectionKeys) {
    createSectionController(key, sections[key] || {})
  }
}

function initLocalFiltering() {
  initialiseFilters()
  initFuseEngines()
  hookSearchInputs()
  hookIssueToggles()
  hookStatusChips()
  hookTypeChips()
  hookPaginationControls()
  hookExports()
  sectionKeys.forEach(applyFilters)
}

/* --------------------
   Global search (MiniSearch + Alpine)
-------------------- */
const searchPayload = payload.search || {}
let globalSearchEngine = null
let documentsById = new Map()

if (Array.isArray(searchPayload.documents)) {
  documentsById = new Map(searchPayload.documents.map(doc => [doc.id, doc]))
}
let indexLoaded = false
if (searchPayload.index && searchPayload.options) {
  try {
    const indexSource = typeof searchPayload.index === 'string'
      ? JSON.parse(searchPayload.index)
      : searchPayload.index
    globalSearchEngine = MiniSearch.loadJSON(indexSource, searchPayload.options)
    indexLoaded = true
  } catch (error) {
    console.warn('[lvreport-app] Failed to load search index:', error)
    globalSearchEngine = null
  }
}
if (!globalSearchEngine) {
  const options = searchPayload.options || {
    fields: ['title', 'description', 'section', 'tags'],
    storeFields: ['id', 'title', 'description', 'href', 'section', 'badge', 'tags'],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  }
  try {
    globalSearchEngine = new MiniSearch(options)
    if (documentsById.size) {
      globalSearchEngine.addAll(Array.from(documentsById.values()))
    }
    if (!indexLoaded && searchPayload.documentCount) {
      console.warn('[lvreport-app] Rebuilt search index in-memory from dataset snapshot.')
    }
  } catch (error) {
    console.warn('[lvreport-app] Search index unavailable:', error)
    globalSearchEngine = null
  }
}
if (!globalSearchEngine && searchPayload.documentCount && !indexLoaded) {
  console.warn('[lvreport-app] Search index missing; global dataset search disabled.')
}

function formatSectionLabel(section) {
  if (!section) return 'Result'
  return section.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase())
}

Alpine.data('globalSearch', () => ({
  open: false,
  query: '',
  results: [],
  activeIndex: 0,
  init() {
    this.handleShortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        this.openPanel()
      }
    }
    document.addEventListener('keydown', this.handleShortcut)
  },
  destroy() {
    document.removeEventListener('keydown', this.handleShortcut)
  },
  openPanel() {
    this.open = true
    this.$nextTick(() => {
      const input = this.$el.querySelector('input[type="search"]')
      input?.focus()
    })
  },
  closePanel() {
    this.open = false
    this.query = ''
    this.results = []
    this.activeIndex = 0
  },
  search() {
    const term = this.query.trim()
    if (!term) {
      this.results = []
      this.activeIndex = 0
      return
    }
    if (!globalSearchEngine) {
      this.results = []
      this.activeIndex = 0
      return
    }
    const hits = globalSearchEngine.search(term, { boost: { title: 2 }, prefix: true, fuzzy: 0.2 })
    this.results = hits.slice(0, 20).map(hit => {
      const doc = documentsById.get(hit.id) || hit
      return {
        id: doc.id,
        title: doc.title || 'Result',
        description: doc.description || '',
        href: doc.href || '',
        section: doc.section || '',
        badge: formatSectionLabel(doc.section),
      }
    })
    this.activeIndex = 0
  },
  move(delta) {
    if (!this.results.length) return
    this.activeIndex = (this.activeIndex + delta + this.results.length) % this.results.length
  },
  setActive(index) {
    this.activeIndex = index
  },
  selectActive() {
    if (!this.results.length) return
    const result = this.results[this.activeIndex]
    this.openResult(result)
  },
  openResult(result) {
    if (!result) return
    if (result.href?.startsWith('#')) {
      this.closePanel()
      const target = document.querySelector(result.href)
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (result.href) {
      window.open(result.href, '_blank', 'noopener')
    }
    this.closePanel()
  },
}))

function initialiseGlobalSearch() {
  // no-op: Alpine handles registration
}

function applyHydratedSections(artifact) {
  if (!artifact?.report?.pages) return
  const currentPageNumber = payload.page?.number ?? 0
  const page = artifact.report.pages.find((entry) => entry.pageNumber === currentPageNumber)
  if (!page?.sections) return
  Object.entries(page.sections).forEach(([section, meta]) => {
    refreshSection(section, meta || {})
  })
}

async function hydrateFromBakedIndex() {
  if (!bakedInfo.indexHref) return
  try {
    const response = await fetch(bakedInfo.indexHref, { credentials: 'same-origin' })
    if (!response.ok) {
      throw new Error(`status ${response.status}`)
    }
    const artifact = await response.json()
    window.__lvreportBakedIndex = artifact
    applyHydratedSections(artifact)
    if (
      artifact?.meta?.generatedAt && emptyBannerEl
      && emptyBannerEl.dataset.unlockOnHydrate !== 'false'
    ) {
      emptyBannerEl.hidden = true
    }
  } catch (error) {
    console.warn('[lvreport-app] Failed to load baked index:', error)
    if (emptyBannerEl) {
      emptyBannerEl.hidden = false
      emptyBannerEl.classList.add('alert-error')
      const detail = emptyBannerEl.querySelector('[data-lvreport-empty-detail]')
      if (detail) {
        detail.textContent = 'Baked LV index unavailable; interactive dataset limited.'
      }
    }
  }
}

function bootstrap() {
  initLocalFiltering()
  initialiseGlobalSearch()
  registerLazyImages(document)
}

hydrateFromBakedIndex()

if (sectionKeys.length) {
  bootstrap()
}

window.Alpine = Alpine
Alpine.start()
