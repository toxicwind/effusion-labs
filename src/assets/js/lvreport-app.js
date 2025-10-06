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

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
const LAZY_MAX_CONCURRENCY = 4

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
    const label = sections[section]?.title || ''
    const baseline = el.textContent.trim()
    originalSummary[section] = label || baseline || section
  }
}

function updateSummary(section, total, filtered, startIndex, endIndex, page, pageCount) {
  const el = document.querySelector(`[data-filter-summary="${section}"]`)
  if (!el) return
  ensureSummaryCache(section)
  const label = originalSummary[section] || section
  if (filtered <= 0) {
    el.textContent = `${label} • No results (0 of ${total})`
    return
  }
  const rangeStart = Math.max(1, startIndex + 1)
  const rangeEnd = Math.max(rangeStart, endIndex)
  const parts = [`${label} • Showing ${rangeStart}–${rangeEnd} of ${filtered}`]
  if (filtered !== total) parts.push(`Filtered from ${total}`)
  else parts.push(`Total ${total}`)
  parts.push(`Page ${page} of ${pageCount}`)
  el.textContent = parts.join(' • ')
}

function updateRowVisibility(section, visibleIds) {
  const rows = document.querySelectorAll(`[data-section-row="${section}"]`)
  rows.forEach(row => {
    const id = row.dataset.entryId
    row.hidden = !visibleIds.has(id)
  })
}

function updatePaginationControls(section, { filtered, page, pageCount }) {
  const prev = document.querySelector(`[data-page-prev="${section}"]`)
  const next = document.querySelector(`[data-page-next="${section}"]`)
  const status = document.querySelector(`[data-page-status="${section}"]`)
  if (prev) prev.disabled = page <= 1 || filtered <= 0
  if (next) next.disabled = filtered <= 0 || page >= pageCount
  if (status) {
    status.textContent = filtered <= 0 ? 'No results' : `Page ${page} / ${pageCount}`
  }
}

function applyFilters(section, { preservePage = false } = {}) {
  const data = sections[section]
  if (!data) return
  const items = data.items || []
  const filterState = filters[section]
  if (!filterState) return
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

  if (!preservePage) filterState.page = 1
  filterState.last = results

  const totalFiltered = results.length
  const pageSize = Math.max(1, filterState.pageSize || DEFAULT_PAGE_SIZE)
  const pageCount = totalFiltered > 0 ? Math.ceil(totalFiltered / pageSize) : 1
  filterState.pageCount = pageCount
  if (filterState.page > pageCount) filterState.page = pageCount
  if (filterState.page < 1) filterState.page = 1

  const startIndex = totalFiltered === 0 ? 0 : (filterState.page - 1) * pageSize
  const endIndex = totalFiltered === 0 ? 0 : Math.min(totalFiltered, startIndex + pageSize)
  const visibleIds = new Set(results.slice(startIndex, endIndex).map(item => item.id))

  updateRowVisibility(section, visibleIds)
  updateSummary(
    section,
    items.length,
    totalFiltered,
    startIndex,
    endIndex,
    filterState.page,
    pageCount,
  )
  updatePaginationControls(section, { filtered: totalFiltered, page: filterState.page, pageCount })

  requestAnimationFrame(() => {
    initLazyImageQueue()
  })
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

function hookPageSizeSelectors() {
  const selects = document.querySelectorAll('[data-page-size]')
  selects.forEach(select => {
    const section = select.dataset.pageSize
    if (!sectionKeys.includes(section)) return
    const state = filters[section]
    if (!state) return
    const desired = Math.max(1, state.pageSize || DEFAULT_PAGE_SIZE)
    const hasOption = Array.from(select.options || []).some(option =>
      Number(option.value) === desired
    )
    if (!hasOption) {
      PAGE_SIZE_OPTIONS.forEach(size => {
        if (Array.from(select.options || []).some(option => Number(option.value) === size)) return
        const option = document.createElement('option')
        option.value = String(size)
        option.textContent = `${size}`
        select.append(option)
      })
    }
    select.value = String(desired)
    select.addEventListener('change', event => {
      const value = Number(event.target.value)
      if (!Number.isFinite(value) || value <= 0) return
      state.pageSize = value
      state.page = 1
      applyFilters(section)
    })
  })
}

function hookPaginationButtons() {
  const prevButtons = document.querySelectorAll('[data-page-prev]')
  prevButtons.forEach(button => {
    const section = button.dataset.pagePrev
    if (!sectionKeys.includes(section)) return
    button.addEventListener('click', () => {
      const state = filters[section]
      if (!state) return
      if (state.page <= 1) return
      state.page = Math.max(1, state.page - 1)
      applyFilters(section, { preservePage: true })
    })
  })

  const nextButtons = document.querySelectorAll('[data-page-next]')
  nextButtons.forEach(button => {
    const section = button.dataset.pageNext
    if (!sectionKeys.includes(section)) return
    button.addEventListener('click', () => {
      const state = filters[section]
      if (!state) return
      const maxPage = Math.max(1, state.pageCount || 1)
      if (state.page >= maxPage) return
      state.page = Math.min(maxPage, state.page + 1)
      applyFilters(section, { preservePage: true })
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
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil((items.length || 0) / DEFAULT_PAGE_SIZE)),
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
  }
}

function initLocalFiltering() {
  initialiseFilters()
  initFuseEngines()
  hookSearchInputs()
  hookIssueToggles()
  hookStatusChips()
  hookTypeChips()
  hookPageSizeSelectors()
  hookPaginationButtons()
  hookExports()
  sectionKeys.forEach(section => applyFilters(section, { preservePage: true }))
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
  initLazyImageQueue()
}

if (sectionKeys.length) {
  bootstrap()
}

function initLazyImageQueue() {
  const nodes = Array.from(document.querySelectorAll('[data-lv-lazy-src]'))
  if (!nodes.length) return

  const queue = []
  let active = 0

  const processQueue = () => {
    if (!queue.length || active >= LAZY_MAX_CONCURRENCY) return
    const img = queue.shift()
    if (!img || img.dataset.lvLazyLoaded) {
      processQueue()
      return
    }
    const src = img.dataset.lvLazySrc
    if (!src) {
      img.dataset.lvLazyLoaded = 'missing'
      processQueue()
      return
    }
    active++
    const loader = new Image()
    loader.decoding = 'async'
    loader.fetchPriority = 'low'
    loader.onload = () => {
      requestAnimationFrame(() => {
        img.src = src
        img.dataset.lvLazyLoaded = '1'
        img.classList.remove('opacity-0')
        img.classList.add('opacity-100')
        img.style.opacity = '1'
      })
      active--
      processQueue()
    }
    loader.onerror = () => {
      img.dataset.lvLazyLoaded = 'error'
      img.classList.remove('opacity-0')
      img.classList.add('opacity-60')
      img.style.opacity = '1'
      active--
      processQueue()
    }
    loader.src = src
  }

  const enqueue = img => {
    if (!img || img.dataset.lvLazyQueued) return
    img.dataset.lvLazyQueued = '1'
    queue.push(img)
    processQueue()
  }

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(img => {
      img.loading = 'lazy'
      img.decoding = 'async'
      img.fetchPriority = 'low'
      enqueue(img)
    })
    return
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const img = entry.target
        if (!img || img.dataset.lvLazyLoaded) {
          observer.unobserve(img)
          return
        }
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          observer.unobserve(img)
          img.loading = 'lazy'
          img.decoding = 'async'
          img.fetchPriority = 'low'
          enqueue(img)
        }
      })
    },
    { rootMargin: '160px 0px', threshold: 0.01 },
  )

  nodes.forEach(img => {
    if (img.dataset.lvLazyBound) return
    img.dataset.lvLazyBound = '1'
    observer.observe(img)
  })
}

window.Alpine = Alpine
Alpine.start()
