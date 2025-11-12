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

const fuseConfigs = {
  images: { keys: ['title', 'basename', 'pageUrl', 'host'], threshold: 0.32, ignoreLocation: true },
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
const IMAGE_DEFAULT_PAGE_SIZE = 25
let imageLazyLoader = null

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

function updateImageSummary({ total, filtered, visible, pageSize }) {
  const el = document.querySelector('[data-image-pagination-summary]')
  if (!el) return
  ensureSummaryCache('images')
  const base = originalSummary.images || el.textContent.trim()
  const state = filters.images || {}
  const details = []
  details.push(`${visible} visible`)
  if (filtered !== visible) details.push(`${filtered} match`)
  details.push(`${total} on page`)
  if (pageSize && pageSize !== IMAGE_DEFAULT_PAGE_SIZE) {
    details.push(`page size ${pageSize}`)
  }
  if (state.host) {
    details.push(`host ${state.host}`)
  }
  if (state.includeDeprecated) {
    details.push('deprecated included')
  }
  if (state.mode && state.mode !== 'all') {
    details.push(state.mode)
  }
  if (
    !state.query
    && !state.host
    && !state.includeDeprecated
    && (state.mode === 'all' || !state.mode)
    && (pageSize === IMAGE_DEFAULT_PAGE_SIZE || !pageSize)
    && filtered === total
    && visible === total
  ) {
    el.textContent = base
    return
  }
  el.textContent = `${base} • ${details.join(' • ')}`
}

function updateRowVisibility(section, visibleIds) {
  const rows = document.querySelectorAll(`[data-section-row="${section}"]`)
  rows.forEach(row => {
    const id = row.dataset.entryId
    const isVisible = visibleIds.has(id)
    row.hidden = !isVisible
    if (section === 'images' && imageLazyLoader) {
      imageLazyLoader.setActive(row, isVisible)
    }
  })
}

function renderImageActiveFilters() {
  if (!sectionKeys.includes('images')) return
  const container = document.querySelector('[data-image-active-filters]')
  if (!container) return
  const state = filters.images
  if (!state) {
    container.innerHTML = ''
    return
  }
  const chips = []
  const mode = state.mode || 'all'
  if (mode !== 'all') {
    chips.push({
      label: `Mode: ${mode}`,
      action: () => {
        state.mode = 'all'
        applyFilters('images')
      },
    })
  }
  if (state.host) {
    chips.push({
      label: `Host: ${state.host}`,
      action: () => {
        state.host = null
        applyFilters('images')
      },
    })
  }
  if (state.includeDeprecated) {
    chips.push({
      label: 'Deprecated shown',
      action: () => {
        state.includeDeprecated = false
        const toggle = document.querySelector('[data-image-include-deprecated]')
        if (toggle) toggle.checked = false
        applyFilters('images')
      },
    })
  }
  const query = (state.query || '').trim()
  if (query) {
    chips.push({
      label: `Search: ${query}`,
      action: () => {
        state.query = ''
        const input = document.querySelector('[data-search-input="images"]')
        if (input) input.value = ''
        applyFilters('images')
      },
    })
  }
  container.innerHTML = ''
  if (!chips.length) {
    container.classList.add('opacity-0')
    container.setAttribute('aria-hidden', 'true')
    return
  }
  container.classList.remove('opacity-0')
  container.removeAttribute('aria-hidden')
  for (const chip of chips) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className =
      'btn btn-xs btn-outline rounded-full border-base-content/30 text-[11px] uppercase tracking-[0.2em] text-base-content/70 hover:border-secondary/60 hover:text-secondary'
    button.textContent = chip.label
    button.addEventListener('click', () => {
      chip.action()
      renderImageActiveFilters()
      updateHostButtons()
    })
    container.append(button)
  }
  const clear = document.createElement('button')
  clear.type = 'button'
  clear.className =
    'btn btn-xs btn-ghost text-[11px] uppercase tracking-[0.2em] text-base-content/60 hover:text-secondary'
  clear.textContent = 'Clear filters'
  clear.addEventListener('click', () => {
    resetImageFilters()
  })
  container.append(clear)
}

function updateHostButtons() {
  if (!sectionKeys.includes('images')) return
  const state = filters.images
  const activeHost = state?.host || ''
  document.querySelectorAll('[data-image-host]').forEach(button => {
    const hostValue = (button.dataset.imageHost || '').trim()
    const isActive = activeHost && hostValue === activeHost
    button.classList.toggle('btn-secondary', isActive)
    button.classList.toggle('btn-ghost', !isActive)
    button.classList.toggle('bg-secondary/20', isActive)
    button.classList.toggle('border-secondary/60', isActive)
    button.classList.toggle('text-secondary-content', isActive)
    button.classList.toggle('text-base-content/70', !isActive)
  })
}

function resetImageFilters() {
  if (!sectionKeys.includes('images')) return
  const state = filters.images
  if (!state) return
  state.mode = 'all'
  state.host = null
  state.includeDeprecated = false
  state.pageSize = IMAGE_DEFAULT_PAGE_SIZE
  state.query = ''
  const searchInput = document.querySelector('[data-search-input="images"]')
  if (searchInput) searchInput.value = ''
  const deprecatedToggle = document.querySelector('[data-image-include-deprecated]')
  if (deprecatedToggle) deprecatedToggle.checked = false
  const pageSizeSelect = document.querySelector('[data-image-page-size]')
  if (pageSizeSelect) pageSizeSelect.value = String(IMAGE_DEFAULT_PAGE_SIZE)
  document.querySelectorAll('[data-image-mode]').forEach(button => {
    const mode = button.dataset.imageMode || 'all'
    const isActive = mode === 'all'
    button.classList.toggle('btn-primary', isActive)
    button.classList.toggle('btn-outline', !isActive)
  })
  applyFilters('images')
  renderImageActiveFilters()
  updateHostButtons()
}

function hookImageHostFilters() {
  if (!sectionKeys.includes('images')) return
  const state = filters.images
  if (!state) return
  document.querySelectorAll('[data-image-host]').forEach(button => {
    const hostValue = (button.dataset.imageHost || '').trim()
    if (!hostValue) return
    button.addEventListener('click', () => {
      state.host = state.host === hostValue ? null : hostValue
      applyFilters('images')
    })
  })
}

function hookImagePageSize() {
  if (!sectionKeys.includes('images')) return
  const select = document.querySelector('[data-image-page-size]')
  if (!select) return
  const state = filters.images
  if (!state) return
  const initial = Number(state.pageSize) || IMAGE_DEFAULT_PAGE_SIZE
  select.value = String(initial)
  select.addEventListener('change', () => {
    const value = Math.max(1, Number(select.value) || IMAGE_DEFAULT_PAGE_SIZE)
    state.pageSize = value
    applyFilters('images')
  })
}

function createImageLazyLoader() {
  const records = new Map()
  const queue = []
  let active = 0
  const LIMIT = 6
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = records.get(entry.target)
      if (!record) continue
      if (entry.isIntersecting) {
        enqueue(record)
      }
    }
  }, { rootMargin: '200px 0px' })

  function register(card) {
    if (!card || records.has(card)) return
    const img = card.querySelector('[data-image-src]')
    const fallback = card.querySelector('[data-image-fallback]')
    records.set(card, {
      card,
      img,
      fallback,
      loading: false,
      loaded: false,
      hidden: card.hidden,
    })
    if (!card.hidden) {
      observer.observe(card)
    }
  }

  function setActive(card, shouldShow) {
    if (!card) return
    if (!records.has(card)) register(card)
    const record = records.get(card)
    if (!record) return
    record.hidden = !shouldShow
    if (record.hidden) {
      observer.unobserve(card)
    } else if (!record.loaded) {
      observer.observe(card)
    }
  }

  function enqueue(record) {
    if (record.hidden || record.loading || record.loaded) return
    if (!queue.includes(record)) queue.push(record)
    flush()
  }

  function flush() {
    while (active < LIMIT && queue.length) {
      const record = queue.shift()
      if (!record || record.hidden || record.loading || record.loaded) continue
      start(record)
    }
  }

  function start(record) {
    const { img, fallback } = record
    const src = img?.dataset?.imageSrc
    if (!img || !src) {
      record.loaded = true
      return
    }
    record.loading = true
    active += 1
    const cleanup = () => {
      record.loading = false
      record.loaded = true
      active = Math.max(0, active - 1)
      flush()
    }
    img.addEventListener('load', () => {
      img.classList.remove('hidden')
      fallback?.classList.add('hidden')
      cleanup()
    }, { once: true })
    img.addEventListener('error', () => {
      img.classList.add('hidden')
      fallback?.classList.remove('hidden')
      cleanup()
    }, { once: true })
    requestAnimationFrame(() => {
      img.src = src
    })
  }

  function refresh() {
    flush()
  }

  return { register, setActive, refresh }
}

function bootstrapImageLazyLoader() {
  if (!sectionKeys.includes('images')) return
  imageLazyLoader = createImageLazyLoader()
  const cards = document.querySelectorAll('[data-image-card]')
  cards.forEach(card => {
    imageLazyLoader.register(card)
  })
  requestAnimationFrame(() => {
    const state = filters.images || {}
    const limit = Math.max(1, Number(state.pageSize) || IMAGE_DEFAULT_PAGE_SIZE)
    let gridIndex = 0
    cards.forEach(card => {
      if (card.hasAttribute('data-image-fresh')) {
        imageLazyLoader.setActive(card, !card.hidden)
        return
      }
      const shouldShow = !card.hidden && gridIndex < limit
      imageLazyLoader.setActive(card, shouldShow)
      if (!card.hidden) gridIndex += 1
    })
    imageLazyLoader.refresh()
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
  if (section === 'images') {
    const mode = filterState.mode || 'all'
    if (mode === 'unique') {
      results = results.filter(item => !item.duplicateOf)
    } else if (mode === 'duplicates') {
      results = results.filter(item => !!item.duplicateOf)
    }
    if (filterState.host) {
      const hostMatch = filterState.host
      results = results.filter(item => (item.host || '').toLowerCase() === hostMatch)
    }
    if (!filterState.includeDeprecated) {
      results = results.filter(item => !item.isDeprecated)
    }
    const pageSize = Math.max(1, Number(filterState.pageSize) || IMAGE_DEFAULT_PAGE_SIZE)
    const limited = results.slice(0, pageSize)
    filters[section].last = results
    filters[section].visible = limited
    const visibleIds = new Set(limited.map(item => item.id))
    updateRowVisibility(section, visibleIds)
    updateImageSummary({
      total: items.length,
      filtered: results.length,
      visible: limited.length,
      pageSize,
    })
    renderImageActiveFilters()
    updateHostButtons()
    imageLazyLoader?.refresh()
    return
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

function hookImageModeButtons() {
  if (!sectionKeys.includes('images')) return
  const group = document.querySelector('[data-image-mode-group]')
  if (!group) return
  const buttons = Array.from(group.querySelectorAll('[data-image-mode]'))
  buttons.forEach(button => {
    button.addEventListener('click', () => {
      const mode = button.dataset.imageMode || 'all'
      const state = filters.images
      if (!state) return
      if (state.mode === mode) return
      state.mode = mode
      buttons.forEach(btn => {
        const active = btn.dataset.imageMode === mode
        btn.classList.toggle('btn-primary', active)
        btn.classList.toggle('btn-outline', !active)
      })
      applyFilters('images')
    })
  })
}

function hookImageDeprecatedToggle() {
  if (!sectionKeys.includes('images')) return
  const toggle = document.querySelector('[data-image-include-deprecated]')
  if (!toggle) return
  const state = filters.images
  if (!state) return
  toggle.checked = !!state.includeDeprecated
  toggle.addEventListener('change', event => {
    state.includeDeprecated = event.target.checked
    applyFilters('images')
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
  images: {
    name: 'lv-images.csv',
    headers: [
      'ID',
      'Image URL',
      'Title',
      'Basename',
      'Host',
      'Page URL',
      'First Seen',
      'Last Seen',
      'Cluster Size',
      'Duplicate Of',
      'Deprecated',
      'Removed At',
    ],
    map: item => [
      item.id || '',
      item.src || '',
      item.title || '',
      item.basename || '',
      item.host || '',
      item.pageUrl || '',
      item.firstSeen || '',
      item.lastSeen || '',
      item.clusterSize ?? (item.duplicateOf ? 2 : 1),
      item.duplicateOf || '',
      item.isDeprecated ? 'yes' : 'no',
      item.removedAt || '',
    ],
  },
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
      mode: 'all',
      includeDeprecated: false,
      last: items,
    }
    if (key === 'images') {
      filters[key].pageSize = IMAGE_DEFAULT_PAGE_SIZE
      filters[key].host = null
      filters[key].visible = items.slice(0, IMAGE_DEFAULT_PAGE_SIZE)
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
  hookImageModeButtons()
  hookImageDeprecatedToggle()
  hookImagePageSize()
  hookImageHostFilters()
  hookExports()
  sectionKeys.forEach(applyFilters)
  renderImageActiveFilters()
  updateHostButtons()
  bootstrapImageLazyLoader()
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
