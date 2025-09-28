import Alpine from 'alpinejs'
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

const filters = {}
const originalSummary = {}

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
    const lower = query.toLowerCase()
    results = items.filter(item => JSON.stringify(item).toLowerCase().includes(lower))
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
if (searchPayload.index && searchPayload.options) {
  try {
    globalSearchEngine = MiniSearch.loadJSON(searchPayload.index, searchPayload.options)
  } catch (error) {
    console.warn('[lvreport-app] Failed to load prebuilt search index:', error)
    globalSearchEngine = null
  }
}
if (!globalSearchEngine) {
  const options = searchPayload.options || {
    fields: ['title', 'description', 'section', 'tags'],
    storeFields: ['id', 'title', 'description', 'href', 'section', 'badge', 'tags'],
    searchOptions: { prefix: true, fuzzy: 0.2 },
  }
  globalSearchEngine = new MiniSearch(options)
  if (documentsById.size) {
    globalSearchEngine.addAll(Array.from(documentsById.values()))
  }
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
