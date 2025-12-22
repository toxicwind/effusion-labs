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
const galleryPayload = payload.images || {}

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
const originalSummary = {}

function initFuseEngines() {
  for (const key of sectionKeys) {
    const items = sections[key]?.items || []
    const config = fuseConfigs[key]
    if (!config || !items.length) continue
    fuseInstances.set(key, new Fuse(items, { includeScore: true, ...config }))
  }
}

function ensureSummaryCache(section) {
  const el = document.querySelector(`[data-filter-summary="${section}"]`)
  if (el && !originalSummary[section]) {
    originalSummary[section] = el.textContent.trim()
  }
}

function updateSummary(section, total, visible) {
  const el = document.querySelector(`[data-filter-summary="${section}"]`)
  if (!el) return
  ensureSummaryCache(section)
  if (!originalSummary[section]) return
  if (visible === total) {
    el.textContent = originalSummary[section]
  } else {
    el.textContent = `${originalSummary[section]} • Filtered ${visible} of ${total}`
  }
}

function updateRowVisibility(section, visibleIds) {
  const rows = document.querySelectorAll(`[data-section-row="${section}"]`)
  rows.forEach(row => {
    const id = row.dataset.entryId
    row.hidden = !visibleIds.has(id)
  })
}

function applyFilters(section) {
  const data = sections[section]
  if (!data) return
  const items = data.items || []
  const filterState = filters[section]
  let results = items

  const query = (filterState.query || '').trim()
  if (query.length) {
    const fuse = fuseInstances.get(section)
    if (fuse) {
      results = fuse.search(query).map(hit => hit.item)
    } else {
      const lower = query.toLowerCase()
      results = items.filter(item => JSON.stringify(item).toLowerCase().includes(lower))
    }
  }

  if (section === 'sitemaps' && filterState.types) {
    results = results.filter(item => filterState.types.has(item.type || 'other'))
  }
  if ((section === 'robots' || section === 'docs') && filterState.statuses) {
    results = results.filter(item => filterState.statuses.has(item.statusCategory || ''))
  }
  if ((section === 'robots' || section === 'docs') && filterState.issuesOnly) {
    results = results.filter(item => item.isIssue)
  }

  filters[section].last = results
  const visibleIds = new Set(results.map(item => item.id))
  updateRowVisibility(section, visibleIds)
  updateSummary(section, items.length, visibleIds.size)
}

function hookSearchInputs() {
  const inputs = document.querySelectorAll('[data-search-input]')
  inputs.forEach(input => {
    const section = input.dataset.searchInput
    if (!sectionKeys.includes(section)) return
    input.addEventListener('input', event => {
      filters[section].query = event.target.value
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
      filters[section].issuesOnly = toggle.checked
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
      const set = filters[section].statuses
      if (!set) return
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
        const active = filters[section].types
        if (!active) return
        if (active.has(type) && active.size > 1) {
          active.delete(type)
          button.classList.remove('btn-primary')
          button.classList.add('btn-outline')
        } else {
          active.add(type)
          button.classList.add('btn-primary')
          button.classList.remove('btn-outline')
        }
        applyFilters(section)
      })
    })
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

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

function formatDate(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (!date || Number.isNaN(date.valueOf())) return '—'
  return dateFormatter.format(date)
}

function toTimestamp(value) {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  if (!date || Number.isNaN(date.valueOf())) return 0
  return date.valueOf()
}

function hostFromValue(value) {
  if (!value) return ''
  const text = String(value).trim()
  if (!text) return ''
  if (text.includes('://')) {
    try {
      return new URL(text).host.toLowerCase()
    } catch {}
  }
  try {
    return new URL(`https://${text}`).host.toLowerCase()
  } catch {
    return text.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase()
  }
}

function createLazyImageQueue({ concurrency = 6 } = {}) {
  const queue = []
  let active = 0

  const observer = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          observer.unobserve(entry.target)
          enqueue(entry.target)
        }
      }
    }, { rootMargin: '240px 0px', threshold: 0.05 })
    : null

  function enqueue(img) {
    if (!img) return
    if (img.dataset.state === 'loaded' || img.dataset.state === 'error') return
    if (img.dataset.loading === 'active' || img.dataset.loading === 'queued') return
    img.dataset.loading = 'queued'
    queue.push(img)
    process()
  }

  function process() {
    if (active >= concurrency) return
    const img = queue.shift()
    if (!img) return
    if (img.dataset.state === 'loaded' || img.dataset.state === 'error') {
      img.dataset.loading = ''
      process()
      return
    }
    if (!document.contains(img)) {
      img.dataset.loading = ''
      process()
      return
    }
    const src = img.dataset.lazySrc || img.dataset.src
    if (!src) {
      img.dataset.loading = ''
      img.dataset.state = 'error'
      process()
      return
    }
    active++
    img.dataset.loading = 'active'
    img.dataset.state = 'loading'
    const cleanup = (state) => {
      active = Math.max(0, active - 1)
      img.dataset.loading = ''
      img.dataset.state = state
      if (state === 'loaded') {
        img.removeAttribute('data-lazy-src')
      }
      process()
    }
    const onLoad = () => {
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
      cleanup('loaded')
    }
    const onError = () => {
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
      cleanup('error')
    }
    img.addEventListener('load', onLoad, { once: true })
    img.addEventListener('error', onError, { once: true })
    img.src = src
  }

  return {
    observe(root) {
      if (!root) return
      const images = root.querySelectorAll('img[data-lazy-src]')
      images.forEach((img) => {
        if (img.dataset.state === 'loaded' || img.dataset.state === 'error') return
        if (observer) {
          observer.observe(img)
        } else {
          enqueue(img)
        }
      })
    },
  }
}

const lazyLoader = createLazyImageQueue({ concurrency: 6 })

Alpine.data('lvGallery', () => ({
  items: [],
  fresh: [],
  hosts: [],
  stats: { total: 0, active: 0, deprecated: 0, duplicates: 0, filtered: 0 },
  query: '',
  hostFilter: 'all',
  sort: 'newest',
  pageSize: 25,
  page: 1,
  pageCount: 1,
  visible: [],
  filteredTotal: 0,
  rangeLabel: '0',
  showDuplicates: false,
  showDeprecated: false,
  init() {
    const raw = Array.isArray(galleryPayload.items) ? galleryPayload.items : []
    this.items = raw.map((item) => this.normaliseItem(item))
    this.hosts = Array.from(new Set(this.items.map((item) => item.host).filter(Boolean))).sort((
      a,
      b,
    ) => a.localeCompare(b))
    this.fresh = this.items
      .slice()
      .sort((a, b) => b.lastSeenTs - a.lastSeenTs || b.firstSeenTs - a.firstSeenTs)
      .slice(0, 12)
    this.stats = this.computeStats()
    this.pageSize = 25
    this.page = 1
    this.rangeLabel = '0'
    this.refresh()
  },
  normaliseItem(item = {}) {
    const firstSeenTs = toTimestamp(item.firstSeen)
    const lastSeenTs = toTimestamp(item.lastSeen) || firstSeenTs
    const host = hostFromValue(item.host) || hostFromValue(item.pageUrl) || hostFromValue(item.src)
    const basename = (item.basename || '').trim() || (item.id || '')
    const displayTitle = (item.title || '').trim() || basename || item.src || item.id || 'Image'
    const searchText = [
      displayTitle,
      basename,
      host,
      item.pageUrl,
      item.sitemap,
      item.id,
      item.duplicateOf,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return {
      ...item,
      host,
      basename,
      displayTitle,
      searchText,
      firstSeenTs,
      lastSeenTs,
      firstSeenLabel: formatDate(item.firstSeen),
      lastSeenLabel: formatDate(item.lastSeen || item.firstSeen),
      isDeprecated: Boolean(item.removedAt),
      isDuplicate: Boolean(item.duplicateOf),
    }
  },
  computeStats() {
    const totals = galleryPayload.totals || {}
    const total = typeof totals.images === 'number' ? totals.images : this.items.length
    const active = typeof totals.active === 'number'
      ? totals.active
      : this.items.filter((item) => !item.isDeprecated).length
    const deprecated = typeof totals.deprecated === 'number'
      ? totals.deprecated
      : Math.max(0, total - active)
    const duplicates = typeof totals.duplicates === 'number'
      ? totals.duplicates
      : this.items.filter((item) => item.isDuplicate && !item.isDeprecated).length
    const filtered = typeof totals.filtered === 'number' ? Math.max(0, totals.filtered) : 0
    return { total, active, deprecated, duplicates, filtered }
  },
  getFilteredList() {
    let list = this.items.slice()
    if (!this.showDeprecated) {
      list = list.filter((item) => !item.isDeprecated)
    }
    if (this.showDuplicates) {
      list = list.filter((item) => item.isDuplicate)
    }
    if (this.hostFilter && this.hostFilter !== 'all') {
      list = list.filter((item) => item.host === this.hostFilter)
    }
    if (this.query) {
      const lower = this.query.toLowerCase()
      list = list.filter((item) => item.searchText.includes(lower))
    }
    return list
  },
  sortList(list) {
    switch (this.sort) {
      case 'host':
        list.sort((a, b) =>
          (a.host || '').localeCompare(b.host || '') || a.basename.localeCompare(b.basename)
        )
        break
      case 'basename':
        list.sort((a, b) => a.basename.localeCompare(b.basename) || b.lastSeenTs - a.lastSeenTs)
        break
      case 'duplicates':
        list.sort((a, b) => {
          const dupA = a.isDuplicate ? 1 : 0
          const dupB = b.isDuplicate ? 1 : 0
          if (dupA !== dupB) return dupB - dupA
          return b.lastSeenTs - a.lastSeenTs || a.basename.localeCompare(b.basename)
        })
        break
      default:
        list.sort((a, b) =>
          b.lastSeenTs - a.lastSeenTs || b.firstSeenTs - a.firstSeenTs
          || a.basename.localeCompare(b.basename)
        )
    }
  },
  refresh() {
    const list = this.getFilteredList()
    this.sortList(list)
    this.filteredTotal = list.length
    this.pageCount = Math.max(1, Math.ceil(list.length / this.pageSize))
    if (this.page > this.pageCount) this.page = this.pageCount
    if (this.page < 1) this.page = 1
    const start = (this.page - 1) * this.pageSize
    const end = start + this.pageSize
    this.visible = list.slice(start, end)
    this.rangeLabel = this.visible.length ? `${start + 1}–${start + this.visible.length}` : '0'
    this.$nextTick(() => {
      if (this.$refs?.grid) lazyLoader.observe(this.$refs.grid)
      if (this.$refs?.fresh) lazyLoader.observe(this.$refs.fresh)
    })
  },
  setQuery(value) {
    this.query = (value || '').trim()
    this.page = 1
    this.refresh()
  },
  setHost(value) {
    this.hostFilter = value || 'all'
    this.page = 1
    this.refresh()
  },
  setSort(value) {
    this.sort = value || 'newest'
    this.page = 1
    this.refresh()
  },
  setPageSize(value) {
    const size = Number.parseInt(value, 10)
    this.pageSize = Number.isFinite(size) && size > 0 ? size : 25
    this.page = 1
    this.refresh()
  },
  toggleDuplicates() {
    this.showDuplicates = !this.showDuplicates
    this.page = 1
    this.refresh()
  },
  toggleDeprecated() {
    this.showDeprecated = !this.showDeprecated
    this.page = 1
    this.refresh()
  },
  nextPage() {
    if (this.page < this.pageCount) {
      this.page += 1
      this.refresh()
    }
  },
  prevPage() {
    if (this.page > 1) {
      this.page -= 1
      this.refresh()
    }
  },
  jumpPage(value) {
    const target = Number.parseInt(value, 10)
    if (!Number.isFinite(target)) return
    const clamped = Math.min(Math.max(target, 1), this.pageCount)
    if (clamped !== this.page) {
      this.page = clamped
      this.refresh()
    }
  },
}))

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

function initialiseFilters() {
  for (const key of sectionKeys) {
    const items = sections[key]?.items || []
    filters[key] = {
      query: '',
      issuesOnly: false,
      types: null,
      statuses: null,
      last: items,
    }
    if (key === 'sitemaps') {
      const allTypes = new Set(items.map(item => item.type || 'other'))
      filters[key].types = allTypes
      const chipButtons = document.querySelectorAll('[data-filter-chips="sitemaps"] [data-type]')
      chipButtons.forEach(btn => {
        btn.classList.add('btn-primary')
        btn.classList.remove('btn-outline')
      })
    }
    if (key === 'robots' || key === 'docs') {
      const statuses = new Set(items.map(item => item.statusCategory || ''))
      filters[key].statuses = statuses
      document
        .querySelectorAll(`.status-chip[data-section="${key}"]`)
        .forEach(btn => btn.classList.add('btn-active'))
    }
    updateSummary(key, items.length, items.length)
  }
}

function initLocalFiltering() {
  initialiseFilters()
  initFuseEngines()
  hookSearchInputs()
  hookIssueToggles()
  hookStatusChips()
  hookTypeChips()
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

function bootstrap() {
  initLocalFiltering()
  initialiseGlobalSearch()
}

if (sectionKeys.length) {
  bootstrap()
}

window.Alpine = Alpine
Alpine.start()
