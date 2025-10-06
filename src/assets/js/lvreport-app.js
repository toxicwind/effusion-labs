import MiniSearch from 'minisearch'
import Fuse from 'fuse.js'

const datasetEl = document.getElementById('lvreport-data')
const payload = datasetEl ? JSON.parse(datasetEl.textContent || '{}') : {}

const MINI_SEARCH_OPTIONS = {
  fields: ['title', 'sku', 'locale', 'productType', 'tags'],
  storeFields: ['id', 'title', 'sku', 'locale', 'productType', 'pageUrl', 'imageUrl', 'hasHero', 'imageCount', 'updatedAt'],
  searchOptions: {
    boost: { title: 2, sku: 2 },
    prefix: true,
    fuzzy: 0.2,
  },
}

const BANNED_HOSTS = new Set(['www.olyv.co.in', 'app.urlgeni.us'])

const getHostname = (value) => {
  if (!value) return ''
  try {
    const url = new URL(value)
    return (url.hostname || '').toLowerCase()
  } catch (error) {
    return String(value).toLowerCase()
  }
}

const isBannedUrl = (value) => {
  const host = getHostname(value)
  return host ? BANNED_HOSTS.has(host) : false
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

class ImageRequestQueue {
  constructor(limit = 4) {
    this.limit = limit
    this.queue = []
    this.active = 0
  }

  enqueue(src, element) {
    if (!src || !element) return
    if (isBannedUrl(src)) return
    this.queue.push({ src, element })
    this.flush()
  }

  flush() {
    while (this.active < this.limit && this.queue.length) {
      const job = this.queue.shift()
      if (!job) return
      this.active++
      const loader = new Image()
      loader.decoding = 'async'
      loader.loading = 'lazy'
      loader.referrerPolicy = 'no-referrer'
      const cleanup = () => {
        this.active = Math.max(0, this.active - 1)
        this.flush()
      }
      loader.addEventListener('load', () => {
        requestAnimationFrame(() => {
          job.element.src = job.src
          job.element.classList.remove('opacity-0')
          job.element.classList.add('opacity-100')
          job.element.dataset.loaded = 'true'
          cleanup()
        })
      })
      loader.addEventListener('error', () => {
        job.element.dataset.error = 'true'
        job.element.classList.add('opacity-30')
        cleanup()
      })
      loader.src = job.src
    }
  }
}

const fuseOptions = {
  keys: ['title', 'sku', 'locale', 'productType', 'tags'],
  includeScore: true,
  threshold: 0.32,
}

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0))

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

class LvReportApp {
  constructor(root) {
    this.root = root
    this.state = {
      query: '',
      page: 1,
      pageSize: 25,
      facetLocales: new Set(),
      facetTypes: new Set(),
      facetMonths: new Set(),
      heroOnly: false,
    }
    this.rows = []
    this.filteredRows = []
    this.searchEngine = null
    this.searchDocuments = []
    this.fuse = null
    this.bundleMeta = null
    this.metrics = null

    this.bindings = {
      tableBody: root.querySelector('[data-lvreport="table-body"]'),
      tableSummary: root.querySelector('[data-lvreport="table-summary"]'),
      pageStatus: root.querySelector('[data-lvreport="page-status"]'),
      pagePrev: root.querySelector('[data-lvreport="page-prev"]'),
      pageNext: root.querySelector('[data-lvreport="page-next"]'),
      pageSize: root.querySelector('[data-lvreport="page-size"]'),
      tableSearch: root.querySelector('[data-lvreport="table-search"]'),
      facetPanel: root.querySelector('[data-lvreport="facet-panel"]'),
      facetLocale: root.querySelector('[data-lvreport="facet-locale"]'),
      facetType: root.querySelector('[data-lvreport="facet-type"]'),
      facetMonth: root.querySelector('[data-lvreport="facet-month"]'),
      facetHero: root.querySelector('[data-lvreport="facet-hero"]'),
      facetApply: root.querySelector('[data-lvreport="facet-apply"]'),
      facetReset: root.querySelector('[data-lvreport="facet-reset"]'),
      openDrawer: root.querySelector('[data-lvreport="open-drawer"]'),
      toggleFacets: root.querySelector('[data-lvreport="toggle-facets"]'),
      bundleMeta: root.querySelector('[data-lvreport="bundle-meta"]'),
      mapCount: root.querySelector('[data-lvreport="map-count"]'),
      hostsList: root.querySelector('[data-lvreport="hosts-list"]'),
      robotsList: root.querySelector('[data-lvreport="robots-list"]'),
      docsList: root.querySelector('[data-lvreport="docs-list"]'),
      duplicateList: root.querySelector('[data-lvreport="duplicate-list"]'),
      productList: root.querySelector('[data-lvreport="product-list"]'),
      sampleGrid: root.querySelector('[data-lvreport="sample-grid"]'),
      openSearch: root.querySelector('[data-lvreport="open-search"]'),
      searchInput: root.querySelector('[data-lvreport="global-search"]'),
      searchButton: root.querySelector('[data-lvreport="search-open"]'),
      detailContent: root.querySelector('[data-lvreport="detail-content"]'),
      detailPanel: root.querySelector('[data-lvreport="detail-panel"]'),
    }

    this.detailToggle = document.getElementById('lvreport-drawer-toggle')
    this.filterToggle = document.getElementById('lvreport-filters-toggle')

    this.commandPalette = null
    this.commandInput = null
    this.commandResults = null
    this.imageQueue = new ImageRequestQueue(4)
    this.galleryObserver = null
  }

  async init() {
    await this.fetchData()
    this.syncControls()
    this.bindEvents()
    this.renderMeta()
    this.renderFacets()
    this.applyFilters()
    this.renderAncillary()
    this.installKeyboardShortcuts()
  }

  syncControls() {
    if (this.bindings.pageSize) {
      this.bindings.pageSize.value = String(this.state.pageSize)
    }
  }

  sanitizeRows(rows = []) {
    if (!Array.isArray(rows)) return []
    return rows.filter((row) => row && !isBannedUrl(row.pageUrl) && !isBannedUrl(row.imageUrl))
  }

  sanitizeMeta(meta = {}, rowsCount = 0) {
    if (!meta || typeof meta !== 'object') return {}
    const summary = meta.summary && typeof meta.summary === 'object' ? { ...meta.summary } : {}
    if (Array.isArray(summary.hosts)) {
      summary.hosts = summary.hosts.filter((entry) => !isBannedUrl(entry?.host || entry?.id || entry))
    }
    if (Array.isArray(summary.sitemaps)) {
      summary.sitemaps = summary.sitemaps.filter((entry) => !isBannedUrl(entry?.url || entry?.loc || entry))
    }

    const next = { ...meta, summary }
    if (Array.isArray(meta.products)) {
      next.products = meta.products.filter((product) => !isBannedUrl(product?.pageUrl || product?.url))
    }
    if (Array.isArray(meta.images)) {
      next.images = meta.images.filter((image) => !isBannedUrl(image?.pageUrl || image?.url || image?.src))
    }
    if (Array.isArray(meta.docs)) {
      next.docs = meta.docs.filter((doc) => !isBannedUrl(doc?.url || doc?.path || doc?.host))
    }
    if (Array.isArray(meta.robots)) {
      next.robots = meta.robots.filter((robot) => !isBannedUrl(robot?.host))
    }

    const totals = { ...(meta.totals || {}) }
    if (Array.isArray(next.products)) totals.products = next.products.length
    if (Array.isArray(next.docs)) totals.documents = next.docs.length
    if (Array.isArray(next.robots)) totals.robots = next.robots.length
    if (Array.isArray(next.images)) totals.images = next.images.length
    if (Array.isArray(next.summary?.hosts)) totals.summaryHosts = next.summary.hosts.length
    if (Array.isArray(next.summary?.locales)) totals.locales = next.summary.locales.length
    totals.items = typeof totals.items === 'number' ? totals.items : rowsCount
    next.totals = totals
    return next
  }

  async fetchData() {
    const indexUrl = payload.indexHref || '/assets/data/lvreport/index.json'
    const metaUrl = payload.metaHref || '/assets/data/lvreport/meta.json'
    const metricsUrl = payload.metricsHref || '/assets/data/lvreport/ingest-metrics.json'
    const searchUrl = payload.searchHref || '/assets/data/lvreport/search-index.json'

    const [indexData, metaData, metricsData, searchData] = await Promise.all([
      fetch(indexUrl).then((res) => res.json()),
      fetch(metaUrl).then((res) => res.json()),
      fetch(metricsUrl).then((res) => res.json()).catch(() => null),
      fetch(searchUrl).then((res) => res.json()).catch(() => null),
    ])

    const rawRows = Array.isArray(indexData?.rows) ? indexData.rows : []
    this.rows = this.sanitizeRows(rawRows)
    this.meta = this.sanitizeMeta(indexData?.meta || metaData || {}, this.rows.length)
    this.metrics = metricsData || this.meta?.metrics || {}

    const allowedIds = new Set(this.rows.map((row) => row.id))
    if (searchData?.index) {
      this.searchEngine = MiniSearch.loadJSON(searchData.index, MINI_SEARCH_OPTIONS)
      if (Array.isArray(searchData.documents)) {
        this.searchDocuments = searchData.documents.filter((doc) => allowedIds.has(doc.id))
      }
    } else {
      this.searchEngine = new MiniSearch(MINI_SEARCH_OPTIONS)
      this.searchDocuments = this.rows.map((row) => ({
        id: row.id,
        title: row.title,
        sku: row.sku,
        locale: row.locale,
        productType: row.productType,
        pageUrl: row.pageUrl,
        imageUrl: row.imageUrl,
        hasHero: row.hasHero,
        imageCount: row.imageCount,
        updatedAt: row.updatedAt,
        tags: Array.isArray(row.tags) ? row.tags.join(' ') : '',
      }))
      this.searchEngine.addAll(this.searchDocuments)
    }

    this.fuse = new Fuse(this.rows, fuseOptions)
  }

  bindEvents() {
    this.bindings.tableSearch?.addEventListener('input', (event) => {
      this.state.query = event.target.value.trim()
      this.state.page = 1
      this.applyFilters()
    })

    this.bindings.pagePrev?.addEventListener('click', () => {
      if (this.state.page > 1) {
        this.state.page--
        this.renderTable()
      }
    })

    this.bindings.pageNext?.addEventListener('click', () => {
      const pageCount = this.getPageCount()
      if (this.state.page < pageCount) {
        this.state.page++
        this.renderTable()
      }
    })

    this.bindings.pageSize?.addEventListener('change', (event) => {
      this.state.pageSize = Number(event.target.value) || 25
      this.state.page = 1
      this.renderTable()
    })

    this.bindings.openDrawer?.addEventListener('click', () => this.openFacetDrawer())
    this.bindings.toggleFacets?.addEventListener('click', () => this.openFacetDrawer())
    this.bindings.facetApply?.addEventListener('click', () => {
      this.filterToggle.checked = false
      this.state.page = 1
      this.applyFilters()
    })
    this.bindings.facetReset?.addEventListener('click', () => {
      this.state.facetLocales.clear()
      this.state.facetTypes.clear()
      this.state.facetMonths.clear()
      this.state.heroOnly = false
      if (this.bindings.facetHero) this.bindings.facetHero.checked = false
      this.renderFacetSelection()
      this.state.page = 1
      this.applyFilters()
    })
    this.bindings.facetHero?.addEventListener('change', (event) => {
      this.state.heroOnly = event.target.checked
    })

    this.bindings.openSearch?.addEventListener('click', () => this.showCommandPalette())
    this.bindings.searchButton?.addEventListener('click', () => this.showCommandPalette())
    this.bindings.searchInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        this.showCommandPalette(this.bindings.searchInput.value)
      }
    })
  }

  installKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        this.showCommandPalette()
      }
    })
  }

  renderMeta() {
    if (this.bindings.bundleMeta) {
      const sha = this.meta?.bundle?.sha256 ? String(this.meta.bundle.sha256).slice(0, 12) : 'unknown'
      const size = this.meta?.bundle?.size
        ? `${formatNumber(Math.round(this.meta.bundle.size / 1024 / 1024))} MB`
        : '—'
      const parseMs = this.metrics?.parseMs ? `${formatNumber(this.metrics.parseMs)} ms` : '—'
      this.bindings.bundleMeta.innerHTML = `
        <span class="badge badge-outline">SHA ${sha}</span>
        <span class="badge badge-outline">${size}</span>
        <span class="badge badge-outline">Parsed in ${parseMs}</span>
      `
    }
    if (this.bindings.mapCount && Array.isArray(this.rows)) {
      this.bindings.mapCount.textContent = `${formatNumber(this.rows.length)} items`
    }
  }

  renderFacets() {
    const facets = payload.facets || this.meta?.facets || {}
    this.renderFacetGroup(this.bindings.facetLocale, facets.locales, this.state.facetLocales)
    this.renderFacetGroup(this.bindings.facetType, facets.productTypes, this.state.facetTypes)
    this.renderFacetGroup(this.bindings.facetMonth, facets.updatedMonths, this.state.facetMonths, {
      asPills: false,
      labelFormatter: (entry) => entry.value,
    })
    this.renderFacetSelection()
  }

  renderFacetGroup(container, entries, selection, { asPills = true, labelFormatter } = {}) {
    if (!container) return
    container.innerHTML = ''
    if (!Array.isArray(entries) || !entries.length) {
      container.innerHTML = '<p class="text-xs opacity-60">No data</p>'
      return
    }
    for (const entry of entries) {
      const value = entry?.value ?? entry
      const count = entry?.count ?? 0
      const node = document.createElement(asPills ? 'button' : 'label')
      node.className = asPills
        ? 'btn btn-xs btn-outline'
        : 'flex cursor-pointer items-center justify-between rounded-lg border border-base-200 bg-base-100 px-2 py-1 text-xs'
      node.dataset.value = value
      node.textContent = labelFormatter ? labelFormatter(entry) : value
      if (asPills) {
        node.appendChild(document.createElement('span')).textContent = ` ${formatNumber(count)}`
      } else {
        const countEl = document.createElement('span')
        countEl.className = 'text-[0.7rem] opacity-60'
        countEl.textContent = formatNumber(count)
        node.appendChild(countEl)
      }
      node.addEventListener('click', () => {
        if (selection.has(value)) {
          selection.delete(value)
        } else {
          selection.add(value)
        }
        this.renderFacetSelection()
      })
      container.appendChild(node)
    }
  }

  renderFacetSelection() {
    for (const container of [this.bindings.facetLocale, this.bindings.facetType]) {
      if (!container) continue
      container.querySelectorAll('button').forEach((btn) => {
        const value = btn.dataset.value
        const selection = container === this.bindings.facetLocale
          ? this.state.facetLocales
          : this.state.facetTypes
        if (selection.has(value)) {
          btn.classList.add('btn-primary')
          btn.classList.remove('btn-outline')
        } else {
          btn.classList.remove('btn-primary')
          btn.classList.add('btn-outline')
        }
      })
    }
    if (this.bindings.facetMonth) {
      this.bindings.facetMonth.querySelectorAll('label').forEach((label) => {
        const value = label.dataset.value
        const active = this.state.facetMonths.has(value)
        label.classList.toggle('bg-primary/20', active)
        label.classList.toggle('border-primary/30', active)
        if (!label.dataset.bound) {
          label.dataset.bound = '1'
          label.addEventListener('click', () => {
            if (this.state.facetMonths.has(value)) this.state.facetMonths.delete(value)
            else this.state.facetMonths.add(value)
            this.renderFacetSelection()
          })
        }
      })
    }
  }

  applyFilters() {
    const { query, facetLocales, facetTypes, facetMonths, heroOnly } = this.state
    let results = this.rows

    if (facetLocales.size) {
      results = results.filter((row) => facetLocales.has(row.locale || 'unknown'))
    }
    if (facetTypes.size) {
      results = results.filter((row) => facetTypes.has(row.productType || 'other'))
    }
    if (facetMonths.size) {
      results = results.filter((row) => {
        const month = (row.updatedAt || '').slice(0, 7)
        return month && facetMonths.has(month)
      })
    }
    if (heroOnly) {
      results = results.filter((row) => row.hasHero)
    }

    if (query && query.length >= 2) {
      if (this.searchEngine) {
        const hits = this.searchEngine.search(query, MINI_SEARCH_OPTIONS.searchOptions)
        const ids = new Set(hits.map((hit) => hit.id))
        results = results.filter((row) => ids.has(row.id))
      } else if (this.fuse) {
        results = this.fuse.search(query).map((hit) => hit.item)
      }
    }

    this.filteredRows = results
    this.renderTable()
    this.renderSamples()
  }

  getPageCount() {
    if (!this.filteredRows.length) return 1
    return Math.max(1, Math.ceil(this.filteredRows.length / this.state.pageSize))
  }

  renderTable() {
    if (!this.bindings.tableBody) return

    const pageCount = this.getPageCount()
    if (this.state.page > pageCount) this.state.page = pageCount
    const start = (this.state.page - 1) * this.state.pageSize
    const rows = this.filteredRows.slice(start, start + this.state.pageSize)

    if (!rows.length) {
      this.bindings.tableBody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-sm opacity-60">No results match the current filters.</td></tr>'
    } else {
      this.bindings.tableBody.innerHTML = rows
        .map((row) => {
          const badge = row.hasHero ? '<span class="badge badge-success badge-sm">Hero</span>' : ''
          const safeId = escapeHtml(row.id || '')
          const href = row.pageUrl && !isBannedUrl(row.pageUrl) ? row.pageUrl : ''
          const safeHref = href ? escapeHtml(href) : ''
          const safeSku = escapeHtml(row.sku || '—')
          const safeTitle = escapeHtml(row.title || row.pageUrl || 'Untitled')
          const safeLocale = escapeHtml(row.locale || '—')
          const safeType = escapeHtml(row.productType || '—')
          const skuInner = href
            ? `<a class="link link-primary font-mono" href="${safeHref}" target="_blank" rel="noreferrer">${safeSku}</a>`
            : `<span class="font-mono">${safeSku}</span>`
          const titleInner = href
            ? `<a class="link-hover font-semibold" href="${safeHref}" target="_blank" rel="noreferrer">${safeTitle}</a>`
            : `<span class="font-semibold">${safeTitle}</span>`
          return `
            <tr data-id="${safeId}">
              <td class="text-xs">${skuInner}</td>
              <td class="max-w-[320px] truncate">
                ${titleInner}
                ${badge}
              </td>
              <td>${safeLocale}</td>
              <td>${safeType}</td>
              <td class="text-right">${formatNumber(row.imageCount || 0)}</td>
              <td>${formatDate(row.updatedAt)}</td>
              <td class="text-right">
                <button class="btn btn-xs" data-detail="${safeId}">View</button>
              </td>
            </tr>
          `
        })
        .join('')
    }

    this.bindings.tableBody.querySelectorAll('[data-detail]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.detail
        const row = this.rows.find((entry) => entry.id === id)
        if (row) this.showDetail(row)
      })
    })

    this.bindings.tableSummary.textContent = `${formatNumber(this.filteredRows.length)} items • page ${this.state.page} of ${pageCount}`
    this.bindings.pageStatus.textContent = `${this.state.page} / ${pageCount}`
  }

  openFacetDrawer() {
    if (this.filterToggle) this.filterToggle.checked = true
  }

  showDetail(row) {
    if (!this.detailContent) return
    const safeSku = escapeHtml(row.sku || '—')
    const safeTitle = escapeHtml(row.title || row.pageUrl || 'Untitled')
    const safeLocale = escapeHtml(row.locale || '—')
    const safeType = escapeHtml(row.productType || '—')
    const safePageUrl = row.pageUrl && !isBannedUrl(row.pageUrl) ? escapeHtml(row.pageUrl) : ''
    const heroUrl = row.imageUrl && !isBannedUrl(row.imageUrl) ? row.imageUrl : ''
    const safeHeroUrl = heroUrl ? escapeHtml(heroUrl) : ''

    const actionLinks = [
      safePageUrl
        ? `<a class="btn btn-xs btn-primary" href="${safePageUrl}" target="_blank" rel="noreferrer">Open product</a>`
        : '',
      safeHeroUrl ? `<a class="btn btn-xs btn-outline" href="${safeHeroUrl}" target="_blank" rel="noreferrer">Open hero</a>` : '',
    ].filter(Boolean)

    const linkRow = actionLinks.length
      ? `<div class="flex flex-wrap gap-2">${actionLinks.join('')}</div>`
      : ''

    this.detailContent.innerHTML = `
      <div>
        <p class="text-xs uppercase tracking-wide opacity-60">SKU</p>
        <p class="font-semibold">${safeSku}</p>
      </div>
      <div>
        <p class="text-xs uppercase tracking-wide opacity-60">Title</p>
        <p class="font-semibold">${safeTitle}</p>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div><span class="opacity-60">Locale</span><p>${safeLocale}</p></div>
        <div><span class="opacity-60">Type</span><p>${safeType}</p></div>
        <div><span class="opacity-60">Images</span><p>${formatNumber(row.imageCount || 0)}</p></div>
        <div><span class="opacity-60">Updated</span><p>${formatDate(row.updatedAt)}</p></div>
      </div>
      <div class="space-y-2 text-sm">
        <p class="opacity-60">URL</p>
        ${
          safePageUrl
            ? `<a class="link link-primary break-all" href="${safePageUrl}" target="_blank" rel="noreferrer">${safePageUrl}</a>`
            : '<span class="break-all opacity-60">Unavailable</span>'
        }
      </div>
      ${linkRow}
    `

    if (heroUrl) {
      const wrapper = document.createElement('a')
      wrapper.href = heroUrl
      wrapper.target = '_blank'
      wrapper.rel = 'noreferrer'
      wrapper.className = 'mt-4 block overflow-hidden rounded-xl border border-base-300/70 bg-base-200/50'
      const img = document.createElement('img')
      img.alt = row.title || 'Image preview'
      img.loading = 'lazy'
      img.decoding = 'async'
      img.dataset.src = heroUrl
      img.className = 'h-full w-full object-cover opacity-0 transition-opacity duration-500'
      wrapper.appendChild(img)
      this.detailContent.appendChild(wrapper)
      this.imageQueue.enqueue(heroUrl, img)
    }
    if (this.detailToggle) this.detailToggle.checked = true
  }

  renderAncillary() {
    const duplicatesSource = Array.isArray(this.meta?.images)
      ? this.meta.images.filter((img) => img.duplicateOf)
      : []
    this.renderList(this.bindings.duplicateList, duplicatesSource.slice(0, 20), (item) => ({
      title: item.canonical?.title || item.canonicalId || 'Cluster',
      meta: `${item.duplicates?.length || 0} duplicates`,
      href: item.canonical?.pageUrl || item.canonical?.url || item.canonical?.href,
    }))
    this.renderList(this.bindings.productList, (this.meta?.products || []).slice(0, 20), (item) => ({
      title: item.title || item.pageUrl || 'Product',
      meta: `${formatNumber(item.images?.length || 0)} images`,
      href: item.pageUrl,
    }))
    const hostStats = this.meta?.summary?.hosts || []
    this.renderList(this.bindings.hostsList, hostStats.slice(0, 10), (item) => ({
      title: item.host || item.id,
      meta: `${formatNumber(item.images || item.count || 0)} images • ${formatNumber(item.pages || 0)} pages`,
      href: item.host ? `https://${String(item.host).replace(/^https?:\/\//i, '')}` : '',
    }))
    this.renderList(this.bindings.robotsList, (this.meta?.robots || []).slice(0, 10), (item) => ({
      title: item.host,
      meta: `${item.issue ? 'Issues present' : 'OK'} • ${item.agents?.length || 0} agents`,
      href: item.host ? `https://${String(item.host).replace(/^https?:\/\//i, '')}/robots.txt` : '',
    }))
    this.renderList(this.bindings.docsList, (this.meta?.docs || []).slice(0, 10), (item) => ({
      title: item.path || item.url,
      meta: `${item.contentType || 'unknown'} • ${formatNumber(item.size || 0)} bytes`,
      href: item.url,
    }))
    this.renderSamples()
  }

  renderList(container, items, mapper) {
    if (!container) return
    if (!Array.isArray(items) || !items.length) {
      container.innerHTML = '<p class="text-xs opacity-60">No data available.</p>'
      return
    }
    container.innerHTML = items
      .map((item) => {
        const mapped = mapper(item)
        const safeTitle = escapeHtml(mapped.title || '')
        const safeMeta = escapeHtml(mapped.meta || '')
        const safeHref = mapped.href && !isBannedUrl(mapped.href) ? escapeHtml(mapped.href) : ''
        const href = safeHref
          ? `<a class="link link-primary break-all" href="${safeHref}" target="_blank" rel="noreferrer">${safeTitle}</a>`
          : safeTitle
        return `
          <div class="rounded-lg border border-base-300/40 bg-base-100/80 p-3">
            <p class="font-semibold text-sm">${href}</p>
            <p class="text-xs opacity-70">${safeMeta}</p>
          </div>
        `
      })
      .join('')
  }

  renderSamples() {
    const container = this.bindings.sampleGrid
    if (!container) return
    if (!this.filteredRows.length) {
      container.innerHTML = '<p class="text-xs opacity-60">No items match current filters.</p>'
      return
    }

    const sorted = [...this.filteredRows].sort((a, b) => {
      const aDate = (a.updatedAt || a.createdAt || '').slice(0, 19)
      const bDate = (b.updatedAt || b.createdAt || '').slice(0, 19)
      return bDate.localeCompare(aDate)
    })

    const sample = sorted.slice(0, 12)
    if (!sample.length) {
      container.innerHTML = '<p class="text-xs opacity-60">No recent arrivals with imagery available.</p>'
      return
    }

    container.innerHTML = sample.map((row) => this.renderSampleCard(row)).join('')
    this.prepareGalleryImages(container)
  }

  renderSampleCard(row) {
    const heroUrl = row.imageUrl && !isBannedUrl(row.imageUrl) ? row.imageUrl : ''
    const linkTarget = row.pageUrl && !isBannedUrl(row.pageUrl) ? row.pageUrl : heroUrl
    const safeLink = linkTarget ? escapeHtml(linkTarget) : ''
    const safeTitle = escapeHtml(row.title || row.pageUrl || row.sku || 'Item')
    const safeLocale = escapeHtml(row.locale || 'unknown')
    const safeType = escapeHtml(row.productType || '—')
    const updatedLabel = escapeHtml(formatDate(row.updatedAt || row.createdAt))
    const heroBadge = row.hasHero
      ? '<span class="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-content shadow">Hero</span>'
      : ''
    const outerStart = safeLink
      ? `<a class="group flex flex-col overflow-hidden rounded-3xl border border-base-300/40 bg-base-100/80 shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:shadow-2xl" href="${safeLink}" target="_blank" rel="noreferrer">`
      : '<div class="group flex flex-col overflow-hidden rounded-3xl border border-base-300/40 bg-base-100/80 shadow-lg">'
    const outerEnd = safeLink ? '</a>' : '</div>'

    const figure = heroUrl
      ? `
          <div class="relative aspect-[4/5] overflow-hidden">
            ${heroBadge}
            <img data-src="${escapeHtml(heroUrl)}" alt="${safeTitle}" class="h-full w-full object-cover opacity-0 transition-transform duration-500 group-hover:scale-[1.02]" />
            <div class="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 text-white">
              <p class="font-semibold text-sm leading-tight text-white">${safeTitle}</p>
              <p class="text-[11px] uppercase tracking-wide text-white/70">${safeLocale} • ${safeType}</p>
            </div>
          </div>
        `
      : `
          <div class="relative aspect-[4/5] rounded-3xl border border-dashed border-base-300/60 bg-base-200/70 p-4">
            ${heroBadge}
            <div class="flex h-full flex-col justify-end gap-2">
              <span class="badge badge-outline badge-sm">No hero</span>
              <p class="font-semibold text-sm">${safeTitle}</p>
              <p class="text-xs opacity-70">${safeLocale} • ${safeType}</p>
            </div>
          </div>
        `

    const imageCountLabel = escapeHtml(formatNumber(row.imageCount || 0))

    return `
      ${outerStart}
        ${figure}
        <div class="flex items-center justify-between gap-3 px-4 py-3 text-xs">
          <span class="opacity-70">Updated ${updatedLabel}</span>
          <span class="badge badge-ghost badge-sm">${imageCountLabel} img</span>
        </div>
      ${outerEnd}
    `
  }

  prepareGalleryImages(container) {
    if (!container) return
    const images = Array.from(container.querySelectorAll('img[data-src]'))
    if (!images.length) return

    if (this.galleryObserver) {
      this.galleryObserver.disconnect()
    }

    if ('IntersectionObserver' in window) {
      if (!this.galleryObserver) {
        this.galleryObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return
              const target = entry.target
              this.galleryObserver.unobserve(target)
              const src = target.dataset.src
              if (src) {
                this.imageQueue.enqueue(src, target)
              }
            })
          },
          { rootMargin: '200px 0px', threshold: 0.1 },
        )
      }
      images.forEach((img) => {
        img.loading = 'lazy'
        img.decoding = 'async'
        img.classList.add('opacity-0')
        this.galleryObserver.observe(img)
      })
    } else {
      images.forEach((img) => {
        img.loading = 'lazy'
        img.decoding = 'async'
        this.imageQueue.enqueue(img.dataset.src, img)
      })
    }
  }

  createCommandPalette() {
    const container = document.createElement('div')
    container.className = 'fixed inset-0 z-[120] hidden items-start justify-center bg-base-200/80 backdrop-blur'
    container.innerHTML = `
      <div class="mt-24 w-full max-w-2xl rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
        <div class="border-b border-base-300 px-4 py-3">
          <input type="search" class="input input-bordered input-sm w-full" placeholder="Search LV inventory" />
        </div>
        <div class="max-h-80 overflow-auto" data-results></div>
      </div>
    `
    document.body.appendChild(container)
    this.commandPalette = container
    this.commandInput = container.querySelector('input')
    this.commandResults = container.querySelector('[data-results]')

    this.commandInput.addEventListener('input', () => this.renderCommandResults(this.commandInput.value))
    container.addEventListener('click', (event) => {
      if (event.target === container) this.hideCommandPalette()
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !container.classList.contains('hidden')) {
        this.hideCommandPalette()
      }
    })
  }

  showCommandPalette(initialQuery = '') {
    if (!this.commandPalette) this.createCommandPalette()
    this.commandPalette.classList.remove('hidden')
    this.commandInput.value = initialQuery
    this.commandInput.focus()
    this.renderCommandResults(initialQuery)
  }

  hideCommandPalette() {
    if (!this.commandPalette) return
    this.commandPalette.classList.add('hidden')
  }

  renderCommandResults(query) {
    if (!this.commandResults) return
    const trimmed = (query || '').trim()
    let hits = []
    if (trimmed.length >= 2 && this.searchEngine) {
      hits = this.searchEngine.search(trimmed, MINI_SEARCH_OPTIONS.searchOptions)
    } else if (!trimmed) {
      hits = this.searchDocuments.slice(0, 20).map((doc) => ({ id: doc.id, score: 0 }))
    }

    if (!hits.length) {
      this.commandResults.innerHTML = '<p class="px-4 py-6 text-sm opacity-60">No results yet — start typing to search.</p>'
      return
    }

    this.commandResults.innerHTML = hits.slice(0, 40)
      .map((hit) => {
        const doc = this.searchDocuments.find((item) => item.id === hit.id) || {}
        return `
          <button class="flex w-full flex-col items-start gap-1 border-b border-base-200 px-4 py-3 text-left text-sm hover:bg-base-200" data-hit="${hit.id}">
            <span class="font-semibold">${doc.title || doc.pageUrl || doc.sku || 'Result'}</span>
            <span class="text-xs opacity-60">${doc.locale || 'unknown'} • ${doc.productType || '—'} • SKU ${doc.sku || '—'}</span>
          </button>
        `
      })
      .join('')

    this.commandResults.querySelectorAll('[data-hit]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.hit
        const row = this.rows.find((entry) => entry.id === id)
        if (row) {
          this.showDetail(row)
          this.hideCommandPalette()
        }
      })
    })
  }
}

if (datasetEl) {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new LvReportApp(document.body)
    app.init().catch((error) => console.error('[lvreport-app] init failed', error))
  })
}
