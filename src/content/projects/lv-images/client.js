// src/content/projects/lv-images/client.js
// Mounts the Louis Vuitton image sitemap explorer inside the project page.

const SELECTOR = sel => `[data-role="${sel}"]`

const text = value => String(value ?? '')
const hostOf = url => {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}
const pathnameOf = url => {
  try {
    return new URL(url).pathname
  } catch {
    return text(url).split(/[#?]/)[0]
  }
}
const stripQuery = url => {
  try {
    const next = new URL(url)
    next.search = ''
    next.hash = ''
    return next.toString()
  } catch {
    return text(url).split('#')[0]
  }
}

const normalizeUrl = (url, mode) => {
  if (mode === 'exact') return text(url)
  if (mode === 'originless') return pathnameOf(url)
  return stripQuery(url)
}

const uniq = values => Array.from(new Set(values))

const formatNumber = value => new Intl.NumberFormat('en-US').format(Number(value || 0))

function groupByImage(items, mode = 'originless') {
  const map = new Map()
  for (const entry of items) {
    const key = normalizeUrl(entry.src, mode)
    const current = map.get(key) || {
      key,
      reprSrc: entry.src,
      title: entry.title || '',
      hosts: new Set(),
      locales: new Set(),
      pages: new Set(),
      entries: [],
    }
    if (!current.title && entry.title) current.title = entry.title
    current.hosts.add(entry.host || hostOf(entry.src))
    if (entry.locale) current.locales.add(entry.locale)
    if (entry.page) current.pages.add(entry.page)
    current.entries.push(entry)
    if (current.reprSrc && current.reprSrc.includes('?') && !entry.src.includes('?')) {
      current.reprSrc = entry.src
    }
    map.set(key, current)
  }
  return Array.from(map.values()).map(group => ({
    ...group,
    hosts: Array.from(group.hosts).sort(),
    locales: Array.from(group.locales).sort(),
    pages: Array.from(group.pages).slice(0, 10),
    pageCount: group.pages.size,
  }))
}

function sorter(kind) {
  const base = selector => (a, b) => {
    const left = selector(a)
    const right = selector(b)
    if (left > right) return 1
    if (left < right) return -1
    return 0
  }
  switch (kind) {
    case 'page-asc':
      return base(item => text(item.page || item.pages?.[0] || '').toLowerCase())
    case 'page-desc':
      return (a, b) => -base(item => text(item.page || item.pages?.[0] || '').toLowerCase())(a, b)
    case 'img-asc':
      return base(item => text(item.src || item.reprSrc || '').toLowerCase())
    case 'img-desc':
      return (a, b) => -base(item => text(item.src || item.reprSrc || '').toLowerCase())(a, b)
    case 'title-desc':
      return (a, b) => -base(item => text(item.title || '').toLowerCase())(a, b)
    case 'title-asc':
      return base(item => text(item.title || '').toLowerCase())
    case 'host-desc':
      return (a, b) => (b.hosts?.length || 0) - (a.hosts?.length || 0)
    case 'loc-desc':
    default:
      return (a, b) => (b.locales?.length || 0) - (a.locales?.length || 0)
  }
}

function textFilterFn(needle, uniqueMode) {
  if (!needle) return () => true
  const lower = needle.toLowerCase()
  if (uniqueMode) {
    return group =>
      text(group.title).toLowerCase().includes(lower)
      || text(group.reprSrc).toLowerCase().includes(lower)
      || group.hosts.some(h => text(h).toLowerCase().includes(lower))
      || group.locales.some(l => text(l).toLowerCase().includes(lower))
      || group.pages.some(p => text(p).toLowerCase().includes(lower))
  }
  return entry =>
    text(entry.title).toLowerCase().includes(lower)
    || text(entry.src).toLowerCase().includes(lower)
    || text(entry.page).toLowerCase().includes(lower)
    || text(entry.locale).toLowerCase().includes(lower)
    || text(entry.host).toLowerCase().includes(lower)
}

const lazyImageObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    const img = entry.target
    const source = img.getAttribute('data-src')
    if (source && !img.src) {
      img.src = source
      img.onload = () => {
        img.classList.remove('loading-blur')
        img.classList.add('loaded')
      }
    }
    lazyImageObserver.unobserve(img)
  }
})

function makeImage(src, alt) {
  const img = document.createElement('img')
  img.alt = alt
  img.loading = 'lazy'
  img.decoding = 'async'
  img.className = 'w-full rounded-xl bg-base-200 loading-blur transition'
  img.setAttribute('data-src', src)
  lazyImageObserver.observe(img)
  return img
}

function makeBadge(label, tone = 'outline') {
  const span = document.createElement('span')
  span.className = `badge badge-${tone}`
  span.textContent = label
  return span
}

function createCard({ group, entry, uniqueMode, onOpen }) {
  const card = document.createElement('article')
  card.className = 'card hb-tile'

  const body = document.createElement('div')
  body.className = 'card-body p-4 space-y-3'
  card.appendChild(body)

  const title = document.createElement('h3')
  title.className = 'font-semibold text-base line-clamp-2'
  title.textContent = text((uniqueMode ? group?.title : entry?.title) || 'Untitled image')
  body.appendChild(title)

  const media = document.createElement('div')
  media.className = 'overflow-hidden rounded-xl'
  const img = makeImage(uniqueMode ? group.reprSrc : entry.src, title.textContent)
  media.appendChild(img)
  body.appendChild(media)

  const meta = document.createElement('div')
  meta.className = 'flex flex-wrap gap-2 text-xs'
  const locales = uniqueMode ? group.locales : [entry.locale].filter(Boolean)
  const hosts = uniqueMode ? group.hosts : [entry.host].filter(Boolean)
  for (const locale of locales) meta.appendChild(makeBadge(locale, 'neutral'))
  for (const host of hosts) meta.appendChild(makeBadge(host, 'ghost'))
  if (!meta.childNodes.length) meta.appendChild(makeBadge('No locale', 'outline'))
  body.appendChild(meta)

  const actions = document.createElement('div')
  actions.className = 'flex flex-wrap gap-2'
  const openPage = document.createElement('a')
  openPage.className = 'btn btn-sm btn-outline'
  openPage.href = uniqueMode ? group.pages?.[0] || entry.page || '#' : entry.page || '#'
  openPage.target = '_blank'
  openPage.rel = 'noopener'
  openPage.textContent = 'Product page'
  actions.appendChild(openPage)

  const openImage = document.createElement('a')
  openImage.className = 'btn btn-sm btn-primary'
  openImage.href = uniqueMode ? group.reprSrc : entry.src
  openImage.target = '_blank'
  openImage.rel = 'noopener'
  openImage.textContent = 'Open image'
  actions.appendChild(openImage)

  const openModal = document.createElement('button')
  openModal.type = 'button'
  openModal.className = 'btn btn-sm btn-ghost'
  openModal.textContent = 'Details'
  openModal.addEventListener('click', () => onOpen(uniqueMode ? group : entry, { uniqueMode }))
  actions.appendChild(openModal)

  body.appendChild(actions)

  return card
}

function mount(root) {
  const dataUrl = root.getAttribute('data-json-url') || ''
  const metaId = root.getAttribute('data-meta-id')
  const metaScript = metaId ? document.getElementById(metaId) : null
  let meta = null
  if (metaScript) {
    try {
      meta = JSON.parse(metaScript.textContent || 'null')
    } catch (error) {
      console.warn('[lv-images] Unable to parse dataset meta:', error)
    }
  }

  const refs = {
    search: root.querySelector(SELECTOR('search')),
    view: root.querySelector(SELECTOR('view')),
    dedupe: root.querySelector(SELECTOR('dedupe')),
    sort: root.querySelector(SELECTOR('sort')),
    gridSlider: root.querySelector(SELECTOR('grid-slider')),
    batchSlider: root.querySelector(SELECTOR('batch-slider')),
    gridReadout: root.querySelector(SELECTOR('grid-readout')),
    batchReadout: root.querySelector(SELECTOR('batch-readout')),
    reset: root.querySelector(SELECTOR('reset')),
    exportBtn: root.querySelector(SELECTOR('export')),
    statEntries: root.querySelector(SELECTOR('stat-entries')),
    statUnique: root.querySelector(SELECTOR('stat-unique')),
    statDupes: root.querySelector(SELECTOR('stat-dupes')),
    statFilters: root.querySelector(SELECTOR('stat-filters')),
    galleryGrid: root.querySelector('[data-role="grid"]'),
    resultCount: root.querySelector('[data-role="result-count"]'),
    empty: root.querySelector('[data-role="empty"]'),
    sentinel: root.querySelector('[data-role="sentinel"]'),
    facetLocales: root.querySelector('[data-role="facet-locales"]'),
    facetHosts: root.querySelector('[data-role="facet-hosts"]'),
  }

  const modal = document.querySelector('dialog[data-role="modal"]')
  const modalContent = modal ? modal.querySelector('[data-role="modal-content"]') : null

  if (!refs.galleryGrid || !refs.resultCount) {
    return
  }

  const state = {
    search: '',
    view: 'unique',
    dedupe: 'originless',
    sort: 'loc-desc',
    locales: new Set(),
    hosts: new Set(),
    grid: 240,
    batch: 60,
  }

  let rawItems = []
  let currentList = []
  let rendered = 0
  let allLocales = []
  let allHosts = []
  let viewMode = 'unique'

  const sentinelObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && rendered < currentList.length) {
        appendBatch()
      }
    }
  })
  if (refs.sentinel) sentinelObserver.observe(refs.sentinel)

  function setGrid(px) {
    state.grid = px
    document.documentElement.style.setProperty('--tile-min', `${px}px`)
    if (refs.gridReadout) refs.gridReadout.textContent = `${px}px`
  }

  function setBatch(n) {
    state.batch = n
    if (refs.batchReadout) refs.batchReadout.textContent = `${n}`
  }

  function clearGrid() {
    if (refs.galleryGrid) refs.galleryGrid.innerHTML = ''
    rendered = 0
  }

  function activeFilterCount() {
    let count = state.locales.size + state.hosts.size
    if (state.search) count += 1
    return count
  }

  function updateStats() {
    if (refs.statFilters) refs.statFilters.textContent = formatNumber(activeFilterCount())
    if (refs.statEntries) refs.statEntries.textContent = formatNumber(rawItems.length)
    if (refs.resultCount) {
      const prefix = viewMode === 'unique' ? 'Unique images' : 'Entries'
      refs.resultCount.textContent = `${prefix}: ${formatNumber(currentList.length)} / ${
        formatNumber(rawItems.length)
      }`
    }
  }

  function renderFacets(groups) {
    if (!refs.facetLocales || !refs.facetHosts) return
    const localeCounts = new Map()
    const hostCounts = new Map()
    for (const group of groups) {
      const locales = Array.isArray(group.locales) ? group.locales : [group.locale].filter(Boolean)
      const hosts = Array.isArray(group.hosts) ? group.hosts : [group.host].filter(Boolean)
      for (const locale of locales) localeCounts.set(locale, (localeCounts.get(locale) || 0) + 1)
      for (const host of hosts) hostCounts.set(host, (hostCounts.get(host) || 0) + 1)
    }

    refs.facetLocales.innerHTML = ''
    refs.facetHosts.innerHTML = ''

    const renderChip = (parent, value, count, activeSet) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `btn btn-xs ${activeSet.has(value) ? 'btn-primary' : 'btn-outline'}`
      btn.innerHTML = `${text(value)} <span class="badge badge-xs ml-1">${
        formatNumber(count)
      }</span>`
      btn.addEventListener('click', () => {
        if (activeSet.has(value)) activeSet.delete(value)
        else activeSet.add(value)
        update(true)
      })
      parent.appendChild(btn)
    }

    for (const locale of allLocales) {
      renderChip(refs.facetLocales, locale, localeCounts.get(locale) || 0, state.locales)
    }
    for (const host of allHosts) {
      renderChip(refs.facetHosts, host, hostCounts.get(host) || 0, state.hosts)
    }
  }

  function passesFacets(item, uniqueModeActive) {
    if (state.locales.size) {
      const locales = uniqueModeActive
        ? item.locales || []
        : [item.locale].filter(Boolean)
      if (!locales.some(locale => state.locales.has(locale))) return false
    }
    if (state.hosts.size) {
      const hosts = uniqueModeActive ? item.hosts || [] : [item.host].filter(Boolean)
      if (!hosts.some(host => state.hosts.has(host))) return false
    }
    return true
  }

  function createModalContent(payload, { uniqueMode }) {
    if (!modalContent) return
    const data = uniqueMode ? payload : {
      title: payload.title,
      reprSrc: payload.src,
      locales: [payload.locale].filter(Boolean),
      hosts: [payload.host].filter(Boolean),
      pages: [payload.page].filter(Boolean),
    }
    const container = document.createElement('div')
    container.className = 'grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'

    const imgWrap = document.createElement('div')
    imgWrap.appendChild(makeImage(data.reprSrc, text(data.title)))
    container.appendChild(imgWrap)

    const meta = document.createElement('div')
    meta.className = 'space-y-3 text-sm'

    const heading = document.createElement('h3')
    heading.className = 'text-lg font-semibold'
    heading.textContent = text(data.title || 'Untitled image')
    meta.appendChild(heading)

    const links = document.createElement('div')
    links.className = 'flex flex-wrap gap-2'
    const pageLink = document.createElement('a')
    pageLink.className = 'btn btn-sm btn-outline'
    pageLink.href = data.pages?.[0] || '#'
    pageLink.target = '_blank'
    pageLink.rel = 'noopener'
    pageLink.textContent = 'Product page'
    links.appendChild(pageLink)

    const imageLink = document.createElement('a')
    imageLink.className = 'btn btn-sm btn-primary'
    imageLink.href = data.reprSrc
    imageLink.target = '_blank'
    imageLink.rel = 'noopener'
    imageLink.textContent = 'Open image'
    links.appendChild(imageLink)

    meta.appendChild(links)

    const imageUrl = document.createElement('div')
    imageUrl.className = 'text-xs break-all'
    imageUrl.innerHTML =
      `<strong>Image:</strong> <a class="link" target="_blank" rel="noopener" href="${data.reprSrc}">${data.reprSrc}</a>`
    meta.appendChild(imageUrl)

    const pageList = document.createElement('div')
    pageList.className = 'text-xs space-y-1'
    pageList.innerHTML = '<strong>Pages:</strong>'
    if (data.pages && data.pages.length) {
      const list = document.createElement('ul')
      list.className = 'space-y-1'
      for (const page of data.pages) {
        const li = document.createElement('li')
        li.innerHTML = `<a class="link" target="_blank" rel="noopener" href="${page}">${page}</a>`
        list.appendChild(li)
      }
      pageList.appendChild(list)
    } else {
      const empty = document.createElement('p')
      empty.className = 'opacity-70'
      empty.textContent = 'No page references recorded.'
      pageList.appendChild(empty)
    }
    meta.appendChild(pageList)

    const badges = document.createElement('div')
    badges.className = 'flex flex-wrap gap-2'
    for (const locale of data.locales || []) {
      badges.appendChild(makeBadge(`Locale: ${locale}`, 'neutral'))
    }
    for (const host of data.hosts || []) badges.appendChild(makeBadge(`Host: ${host}`, 'ghost'))
    meta.appendChild(badges)

    container.appendChild(meta)
    modalContent.innerHTML = ''
    modalContent.appendChild(container)
  }

  function openModal(payload, opts) {
    if (!modal || !modalContent) return
    createModalContent(payload, opts)
    if (typeof modal.showModal === 'function') {
      modal.showModal()
    } else {
      modal.setAttribute('open', 'true')
    }
  }

  function appendBatch() {
    const batchSize = Number(state.batch) || 60
    const end = Math.min(rendered + batchSize, currentList.length)
    for (let i = rendered; i < end; i += 1) {
      const item = currentList[i]
      const card = viewMode === 'unique'
        ? createCard({ group: item, uniqueMode: true, onOpen: openModal })
        : createCard({ entry: item, uniqueMode: false, onOpen: openModal })
      refs.galleryGrid.appendChild(card)
    }
    rendered = end
  }

  function update(renderFacetsOnly = false) {
    viewMode = refs.view?.value || 'unique'
    state.view = viewMode
    state.dedupe = refs.dedupe?.value || 'originless'
    state.sort = refs.sort?.value || 'loc-desc'
    state.search = refs.search?.value.trim() || ''
    setGrid(Number(refs.gridSlider?.value || state.grid))
    setBatch(Number(refs.batchSlider?.value || state.batch))

    const uniqueMode = viewMode === 'unique'
    const filterFn = textFilterFn(state.search, uniqueMode)

    if (uniqueMode) {
      const groups = groupByImage(rawItems, state.dedupe)
        .filter(filterFn)
        .filter(item => passesFacets(item, true))
        .sort(sorter(state.sort))
      const uniqueCount = groups.length
      const dupes = groups.filter(group => group.entries.length > 1).length
      if (refs.statUnique) refs.statUnique.textContent = formatNumber(uniqueCount)
      if (refs.statDupes) refs.statDupes.textContent = formatNumber(dupes)
      currentList = groups
      if (!renderFacetsOnly) renderFacets(groups)
    } else {
      if (refs.statUnique) refs.statUnique.textContent = '—'
      if (refs.statDupes) refs.statDupes.textContent = '—'
      currentList = rawItems
        .filter(filterFn)
        .filter(item => passesFacets(item, false))
        .sort(sorter(state.sort))
    }

    clearGrid()
    if (!currentList.length) {
      refs.empty?.classList.remove('hidden')
      updateStats()
      return
    }
    refs.empty?.classList.add('hidden')
    appendBatch()
    updateStats()
  }

  function reset() {
    state.locales.clear()
    state.hosts.clear()
    state.search = ''
    state.view = 'unique'
    state.dedupe = 'originless'
    state.sort = 'loc-desc'
    state.grid = 240
    state.batch = 60
    if (refs.search) refs.search.value = ''
    if (refs.view) refs.view.value = 'unique'
    if (refs.dedupe) refs.dedupe.value = 'originless'
    if (refs.sort) refs.sort.value = 'loc-desc'
    if (refs.gridSlider) refs.gridSlider.value = '240'
    if (refs.batchSlider) refs.batchSlider.value = '60'
    renderFacets(groupByImage(rawItems, 'originless'))
    update()
  }

  function exportCurrent() {
    const payload = viewMode === 'unique'
      ? currentList.map(group => ({
        title: group.title,
        src: group.reprSrc,
        locales: group.locales,
        hosts: group.hosts,
        pages: group.pages,
      }))
      : currentList.map(item => ({
        title: item.title,
        src: item.src,
        page: item.page,
        locale: item.locale,
        host: item.host,
      }))
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = viewMode === 'unique' ? 'lv-images-unique.json' : 'lv-images-raw.json'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  refs.search?.addEventListener('input', () => update())
  refs.view?.addEventListener('change', () => update())
  refs.dedupe?.addEventListener('change', () => update())
  refs.sort?.addEventListener('change', () => update())
  refs.gridSlider?.addEventListener('input', () => update(true))
  refs.batchSlider?.addEventListener('input', () => {
    setBatch(Number(refs.batchSlider.value))
  })
  refs.reset?.addEventListener('click', () => reset())
  refs.exportBtn?.addEventListener('click', () => exportCurrent())

  async function loadData() {
    if (!dataUrl) {
      refs.resultCount.textContent = 'Dataset not generated yet.'
      return
    }
    try {
      refs.resultCount.textContent = 'Loading dataset…'
      const res = await fetch(dataUrl)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const payload = await res.json()
      rawItems = Array.isArray(payload.items) ? payload.items : []
      allLocales = uniq(rawItems.map(item => item.locale).filter(Boolean)).sort()
      allHosts = uniq(rawItems.map(item => item.host).filter(Boolean)).sort()
      renderFacets(groupByImage(rawItems, 'originless'))
      update()
    } catch (error) {
      console.error('[lv-images] Failed to load dataset', error)
      refs.resultCount.textContent = 'Failed to load dataset.'
    }
  }

  if (meta?.totals?.images && refs.statEntries) {
    refs.statEntries.textContent = formatNumber(meta.totals.images)
  }

  setGrid(state.grid)
  setBatch(state.batch)
  loadData()
}

export default function init() {
  const roots = document.querySelectorAll('[data-lv-images]')
  roots.forEach(root => {
    if (!root.dataset.lvImagesMounted) {
      root.dataset.lvImagesMounted = 'true'
      mount(root)
    }
  })
}
