// Generalized resolvers powered by the Route Registry; crash-safe and dynamic-by-default.

import { routeRegistry, getByPath } from './route-registry.mjs';
import { recordUnresolved } from './unresolved-report.mjs';

const toStr = (v) => (v == null ? '' : String(v));
const slugify = (s) => toStr(s)
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^\w\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const escapeHtml = (str) => toStr(str)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function buildIndex(kind, arr) {
  const def = routeRegistry.kinds[kind];
  const idx = new Map();
  const put = (key, entry) => {
    const k = slugify(key);
    if (k) idx.set(k, entry);
  };
  for (const entry of arr ?? []) {
    const data = entry?.data || entry; // collections expose page objects; archives expose { data }
    const href = entry?.url || def.canonicalFromData(data);
    const labels = [data?.title, data?.name, data?.product_id, data?.seriesSlug, data?.charSlug, entry?.fileSlug].filter(Boolean);
    const record = { href, data, labels };
    for (const kf of def.keyFields) {
      const v = kf.includes('.') ? getByPath(entry, kf) || getByPath(record, kf) : (data?.[kf] ?? entry?.[kf]);
      if (v) put(v, record);
    }
    for (const a of def.aliasesFromData(data)) put(a, record);
  }
  return idx;
}

function localePrefix(currentPage) {
  if (!routeRegistry.localePrefixEnabled) return '';
  const pageLocale = currentPage?.data?.locale || currentPage?.data?.page?.lang || routeRegistry.defaultLocale;
  return pageLocale && pageLocale !== routeRegistry.defaultLocale ? `/${pageLocale}` : '';
}

function guessHref(kind, nameSlug, currentPage) {
  const def = routeRegistry.kinds[kind];
  const prefix = localePrefix(currentPage);
  return `${prefix}${def.basePath}/${nameSlug}/`;
}

function resolverFor(kind) {
  const def = routeRegistry.kinds[kind];
  if (!def) throw new Error(`Unknown kind: ${kind}`);
  return (link, currentPage /*, interlinker */) => {
    try {
      const data = currentPage?.data || {};
      let dataset = [];
      for (const key of def.datasetKeys) {
        const arr = getByPath(data, key);
        if (Array.isArray(arr) && arr.length) { dataset = arr; break; }
      }
      const index = buildIndex(kind, dataset);
      const wantSlug = slugify(link?.name);
      const entry = index.get(wantSlug);
      let href = entry?.href || def.canonicalFromData(entry?.data || {});
      const prefix = localePrefix(currentPage);
      if (prefix && typeof href === 'string' && href.startsWith('/')) href = prefix + href;
      if (!entry) href = guessHref(kind, wantSlug, currentPage);
      const label = escapeHtml(link?.title || entry?.data?.title || entry?.labels?.find(Boolean) || link?.name);
      if (!entry) {
        recordUnresolved({ kind, key: link?.name, sourcePage: currentPage?.inputPath || currentPage?.data?.page?.inputPath || null, guessedKind: kind, attemptedKinds: [kind] });
        link.href = href;
        return `<a class="interlink interlink--${kind} interlink--soft" href="${href}">${label}</a>`;
      }
      link.href = href;
      return `<a class="interlink interlink--${kind}" href="${href}">${label}</a>`;
    } catch (e) {
      const wantSlug = slugify(link?.name);
      const href = guessHref(kind, wantSlug, currentPage);
      const label = escapeHtml(link?.title || link?.name);
      return `<a class="interlink interlink--${kind} interlink--soft" href="${href}">${label}</a>`;
    }
  };
}

function dispatcherForOmittedKind() {
  const order = routeRegistry.defaultKindsPriority;
  const subResolvers = new Map(order.map((k) => [k, resolverFor(k)]));
  return (link, currentPage /*, interlinker */) => {
    const attempted = [];
    const nameSlug = slugify(link?.name);
    for (const kind of order) {
      attempted.push(kind);
      const html = subResolvers.get(kind)(link, currentPage);
      // Soft links contain interlink--soft; if missing, we found a match
      if (!/interlink--soft/.test(html)) return html;
    }
    // None resolved; record once with guesses
    recordUnresolved({ kind: 'unknown', key: link?.name, sourcePage: currentPage?.inputPath || currentPage?.data?.page?.inputPath || null, guessedKind: order[0], attemptedKinds: attempted });
    const href = guessHref(order[0], nameSlug, currentPage);
    const label = escapeHtml(link?.title || link?.name);
    return `<a class="interlink interlink--soft" href="${href}">${label}</a>`;
  };
}

export function createResolvers() {
  const map = new Map();
  // Default
  map.set('default', (link) => {
    const href = link.href || link.link || '#';
    const label = link.title || link.name || href;
    return `<a class="interlink" href="${href}">${label}</a>`;
  });
  // Named kinds
  for (const kind of Object.keys(routeRegistry.kinds)) {
    map.set(kind, resolverFor(kind));
  }
  // generic docs resolver falls back to default link behaviour
  map.set('docs', (link) => map.get('default')(link));
  // Back-compat synonyms: archive:product etc.
  map.set('archive', (link, currentPage) => {
    const raw = toStr(link?.name);
    const idx = raw.indexOf(':');
    if (idx === -1) return dispatcherForOmittedKind()(link, currentPage);
    const type = raw.slice(0, idx).trim();
    const name = raw.slice(idx + 1).trim();
    const sub = map.get(type) || dispatcherForOmittedKind();
    const next = { ...link, name };
    return sub(next, currentPage);
  });
  map.set('archive:product', map.get('product'));
  map.set('archive:character', map.get('character'));
  map.set('archive:series', map.get('series'));
  // Omitted kind dispatcher
  map.set('omitted', dispatcherForOmittedKind());
  return map;
}
