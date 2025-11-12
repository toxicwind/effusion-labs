import Alpine from 'alpinejs'

const datasetEl = document.getElementById('lvreport-data')
const payloadSource = (() => {
  if (!datasetEl) return null
  if (datasetEl.tagName === 'TEMPLATE') return datasetEl.innerHTML
  return datasetEl.textContent
})()
const payload = payloadSource ? JSON.parse(payloadSource) : {}

const IMAGE_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

function createImageQueue({ concurrency = 6 } = {}) {
  const pending = []
  let active = 0

  const process = () => {
    if (active >= concurrency) return
    const next = pending.shift()
    if (!next) return
    active++
    Promise.resolve()
      .then(() => next())
      .catch(() => {})
      .finally(() => {
        active--
        process()
      })
  }

  return {
    enqueue(task, { priority = false } = {}) {
      if (typeof task !== 'function') return
      if (priority) pending.unshift(task)
      else pending.push(task)
      queueMicrotask(process)
    },
  }
}

function createLazyLoader(queue) {
  const supportsObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window
  const observer = supportsObserver
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting || entry.intersectionRatio > 0) {
          observer.unobserve(entry.target)
          start(entry.target, entry.target.dataset.lvPriority === 'high')
        }
      }
    }, { rootMargin: '280px 0px', threshold: 0.01 })
    : null

  function ensurePlaceholder(el) {
    if (!el.getAttribute('src')) {
      el.setAttribute('src', IMAGE_PLACEHOLDER)
    }
  }

  function start(el, priority = false) {
    if (!el) return
    const src = el.dataset.src || el.getAttribute('data-src') || ''
    if (!src) return
    if (el.dataset.lvLoaded === 'true' || el.dataset.lvLoading === 'true') return
    el.dataset.lvLoading = 'true'
    queue.enqueue(() => new Promise((resolve) => {
      const cleanup = () => {
        el.removeEventListener('load', onLoad)
        el.removeEventListener('error', onError)
      }
      const finish = () => {
        cleanup()
        el.dataset.lvLoading = ''
        resolve()
      }
      const onLoad = () => {
        el.dataset.lvLoaded = 'true'
        finish()
      }
      const onError = () => {
        el.dataset.lvError = 'true'
        el.classList.add('opacity-40')
        finish()
      }
      el.addEventListener('load', onLoad, { once: true })
      el.addEventListener('error', onError, { once: true })
      requestAnimationFrame(() => {
        el.src = src
      })
    }), { priority })
  }

  function register(el, { priority = false } = {}) {
    if (!el || el.dataset.lvRegistered === 'true') {
      if (priority && el && el.dataset.lvLoaded !== 'true') start(el, true)
      return
    }
    el.dataset.lvRegistered = 'true'
    ensurePlaceholder(el)
    if (!el.dataset.src) {
      el.dataset.src = el.getAttribute('data-src') || ''
    }
    if (!el.dataset.src) return
    el.dataset.lvPriority = priority ? 'high' : ''
    if (!observer || priority) {
      start(el, priority)
      return
    }
    observer.observe(el)
  }

  function hydrateStatics(root = document) {
    if (!root) return
    const nodes = root.querySelectorAll('img[data-lv-lazy-static]')
    nodes.forEach((img, index) => {
      const attrPriority = (img.dataset.lvPriority || '').toLowerCase() === 'high'
      register(img, { priority: attrPriority || index < 4 })
    })
  }

  return { register, hydrateStatics }
}

const lazyLoader = createLazyLoader(createImageQueue({ concurrency: 6 }))

function normaliseImage(raw) {
  if (!raw) return null
  const src = raw.src || raw.url || ''
  const pageUrl = raw.pageUrl || raw.href || ''
  const id = String(raw.id || raw.imageId || raw.basename || src || pageUrl || '').trim()
  const basename = raw.basename
    || (src ? src.split(/[#?]/)[0].split('/').pop() : '')
    || (pageUrl ? pageUrl.split(/[#?]/)[0].split('/').pop() : '')
  const host = raw.host || hostFromUrl(pageUrl) || hostFromUrl(src)
  const firstSeen = raw.firstSeen || raw.createdAt || ''
  const lastSeen = raw.lastSeen || raw.updatedAt || firstSeen || ''
  const duplicateOf = raw.duplicateOf || null
  const removedAt = raw.removedAt || null
  const isDeprecated = Boolean(raw.isDeprecated || removedAt)
  return {
    id,
    src,
    pageUrl,
    title: raw.title || raw.name || basename || id,
    basename,
    host,
    firstSeen,
    lastSeen,
    duplicateOf,
    removedAt,
    isDeprecated,
  }
}

function hostFromUrl(value) {
  if (!value) return ''
  try {
    return new URL(value).host
  } catch {
    return ''
  }
}

function createGalleryComponent(initialPayload = {}) {
  const sizes = Array.isArray(initialPayload?.gallery?.pageSizes) && initialPayload.gallery.pageSizes.length
    ? initialPayload.gallery.pageSizes
    : [25, 50, 100, 200]

  return {
    payload: initialPayload,
    pageSizeOptions: sizes,
    pageSize: sizes[0] || 25,
    placeholderSrc: IMAGE_PLACEHOLDER,
    allImages: [],
    visible: [],
    pageItems: [],
    pageIndex: 0,
    pageCount: 1,
    expectedPageCount: 1,
    datasetLoaded: false,
    datasetError: null,
    loading: false,
    prefetchHandle: null,
    sort: 'recent',
    filters: {
      query: '',
      host: '',
      bucket: '',
      state: 'active',
      duplicates: false,
    },
    facets: {
      hosts: Array.isArray(initialPayload?.gallery?.hosts) ? initialPayload.gallery.hosts : [],
      buckets: Array.isArray(initialPayload?.gallery?.dateBuckets) ? initialPayload.gallery.dateBuckets : [],
    },
    get visibleCount() {
      return this.visible.length
    },
    get datasetStatusLabel() {
      if (this.datasetError) return 'Dataset unavailable'
      if (this.datasetLoaded) return 'Full dataset ready'
      if (this.loading) return 'Prefetching dataset…'
      return 'Prefetch queued'
    },
    init() {
      if (!this.payload.gallery) this.payload.gallery = {}
      this.pageSize = this.resolvePageSize(initialPayload?.gallery?.pageSize)
      this.allImages = this.normalizeList(initialPayload?.gallery?.preview?.items || [])
      this.recompute()
      this.schedulePrefetch()
      const watchers = [
        'filters.query',
        'filters.host',
        'filters.bucket',
        'filters.state',
        'filters.duplicates',
        'sort',
      ]
      for (const key of watchers) {
        this.$watch(key, () => {
          this.pageIndex = 0
          this.recompute()
        })
      }
      this.$watch('pageSize', (value) => {
        this.pageSize = this.resolvePageSize(value)
        this.pageIndex = 0
        this.recompute()
      })
    },
    resolvePageSize(value) {
      const numeric = Number(value)
      if (Number.isFinite(numeric) && numeric > 0) return numeric
      return this.pageSizeOptions[0] || 25
    },
    normalizeList(list) {
      return (Array.isArray(list) ? list : [])
        .map((item) => normaliseImage(item))
        .filter(Boolean)
    },
    recompute() {
      const filtered = this.applyFilters(this.allImages)
      this.visible = filtered
      const totalPages = Math.max(1, Math.ceil(filtered.length / this.pageSize))
      if (this.pageIndex >= totalPages) {
        this.pageIndex = totalPages - 1
      }
      const start = this.pageIndex * this.pageSize
      this.pageItems = filtered.slice(start, start + this.pageSize)
      this.pageCount = totalPages
      this.updateExpectedPageCount(filtered.length)
    },
    totalItemsEstimate(filteredLength = null) {
      const payloadTotal = Number(this.payload?.gallery?.totalItems || 0)
      const listTotal = this.allImages.length
      const filteredTotal = filteredLength ?? this.visible.length
      return Math.max(payloadTotal, listTotal, filteredTotal)
    },
    updateExpectedPageCount(filteredLength) {
      const estimate = this.totalItemsEstimate(filteredLength)
      this.expectedPageCount = Math.max(1, Math.ceil(estimate / this.pageSize))
    },
    applyFilters(list) {
      let working = Array.isArray(list) ? [...list] : []
      const query = (this.filters.query || '').trim().toLowerCase()
      const host = (this.filters.host || '').toLowerCase()
      const bucket = this.filters.bucket || ''
      const state = this.filters.state || 'active'
      if (host) {
        working = working.filter((img) => (img.host || '').toLowerCase() === host)
      }
      if (bucket) {
        working = working.filter((img) => (img.lastSeen || img.firstSeen || '').startsWith(bucket))
      }
      if (state === 'active') {
        working = working.filter((img) => !img.isDeprecated)
      } else if (state === 'deprecated') {
        working = working.filter((img) => img.isDeprecated)
      }
      if (this.filters.duplicates) {
        working = working.filter((img) => Boolean(img.duplicateOf))
      }
      if (query) {
        working = working.filter((img) => {
          const haystack = `${img.id} ${img.basename} ${img.title} ${img.host} ${img.pageUrl}`.toLowerCase()
          return haystack.includes(query)
        })
      }
      const compare = this.getComparator()
      working.sort(compare)
      return working
    },
    getComparator() {
      if (this.sort === 'host') {
        return (a, b) => (a.host || '').localeCompare(b.host || '') || a.id.localeCompare(b.id)
      }
      if (this.sort === 'name') {
        return (a, b) => (a.basename || '').localeCompare(b.basename || '') || a.id.localeCompare(b.id)
      }
      if (this.sort === 'duplicates') {
        return (a, b) => {
          const ad = a.duplicateOf ? 0 : 1
          const bd = b.duplicateOf ? 0 : 1
          if (ad !== bd) return ad - bd
          return (b.lastSeen || '').localeCompare(a.lastSeen || '') || a.id.localeCompare(b.id)
        }
      }
      return (a, b) => {
        const keyA = a.lastSeen || a.firstSeen || ''
        const keyB = b.lastSeen || b.firstSeen || ''
        if (keyA === keyB) return a.id.localeCompare(b.id)
        return keyB.localeCompare(keyA)
      }
    },
    prevPage() {
      if (this.pageIndex === 0) return
      this.pageIndex -= 1
      this.recompute()
    },
    async nextPage() {
      if (this.pageIndex + 1 >= this.expectedPageCount) return
      const needsDataset = !this.datasetLoaded && (this.pageIndex + 1) * this.pageSize >= this.allImages.length
      if (needsDataset) {
        await this.ensureDataset()
      }
      if (this.pageIndex + 1 < this.expectedPageCount) {
        this.pageIndex = Math.min(this.pageIndex + 1, this.expectedPageCount - 1)
      }
      this.recompute()
    },
    async ensureDataset({ background = false } = {}) {
      if (this.datasetLoaded || this.loading) return
      const href = this.payload?.gallery?.datasetHref
      if (!href) return
      this.loading = true
      if (this.prefetchHandle) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(this.prefetchHandle)
        } else {
          window.clearTimeout(this.prefetchHandle)
        }
        this.prefetchHandle = null
      }
      if (!background) {
        this.datasetError = null
      }
      try {
        const response = await fetch(href)
        if (!response.ok) throw new Error(`Failed to fetch dataset (${response.status})`)
        const json = await response.json()
        const list = Array.isArray(json?.payload?.allImages) ? json.payload.allImages : []
        if (list.length) {
          const normalized = this.normalizeList(list)
          const map = new Map()
          for (const img of this.allImages) {
            map.set(img.id, img)
          }
          for (const img of normalized) {
            if (map.has(img.id)) {
              const merged = { ...map.get(img.id), ...img }
              merged.isDeprecated = Boolean(merged.isDeprecated)
              map.set(img.id, merged)
            } else {
              map.set(img.id, img)
            }
          }
          this.allImages = Array.from(map.values())
          const reportedTotal = Number(json?.payload?.allImages?.length || 0)
          this.payload.gallery.totalItems = Math.max(
            Number(this.payload?.gallery?.totalItems || 0),
            reportedTotal,
            this.allImages.length,
          )
        }
        this.datasetLoaded = true
        this.datasetError = null
      } catch (error) {
        console.warn('[lv-images] gallery dataset hydration failed', error)
        this.datasetError = error
      } finally {
        this.loading = false
        this.recompute()
        if (!this.datasetLoaded) {
          this.schedulePrefetch()
        }
      }
    },
    retryDataset() {
      this.datasetError = null
      return this.ensureDataset()
    },
    schedulePrefetch() {
      if (this.datasetLoaded || this.prefetchHandle || !this.payload?.gallery?.datasetHref) return
      const run = () => {
        this.prefetchHandle = null
        this.ensureDataset({ background: true })
      }
      if (typeof window.requestIdleCallback === 'function') {
        this.prefetchHandle = window.requestIdleCallback(run, { timeout: 2000 })
      } else {
        this.prefetchHandle = window.setTimeout(run, 1200)
      }
    },
    setHostFilter(host) {
      this.filters.host = host || ''
    },
    registerImage(el, priority = false) {
      if (!el) return
      this.$nextTick(() => {
        lazyLoader.register(el, { priority })
      })
    },
  }
}

document.addEventListener('alpine:init', () => {
  Alpine.data('lvGalleryApp', () => createGalleryComponent(payload))
})

const hydrateStatics = () => lazyLoader.hydrateStatics(document)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateStatics, { once: true })
} else {
  hydrateStatics()
}

window.Alpine = Alpine
Alpine.start()
