<<<<<<< HEAD
import { isIndexEntry } from './utils/collections/utils.mjs'

const CORE_AREAS = [
  {
    key: 'projects',
    totalKey: 'projects',
    label: 'Projects',
    summary: 'Interfaces, prototypes, and builds you can touch.',
    accent: 'from-sky-500/30 via-fuchsia-500/25 to-emerald-400/30',
    icon: 'rocket',
  },
  {
    key: 'concepts',
    totalKey: 'concepts',
    label: 'Concepts',
    summary: 'Frameworks, schemas, and structural thinking.',
    accent: 'from-violet-500/30 via-blue-500/25 to-cyan-400/30',
    icon: 'brain',
  },
  {
    key: 'sparks',
    totalKey: 'sparks',
    label: 'Sparks',
    summary: 'Quick hits, hunches, and early research glimmers.',
    accent: 'from-amber-400/35 via-rose-400/30 to-purple-500/30',
    icon: 'zap',
  },
  {
    key: 'meta',
    totalKey: 'meta',
    label: 'Meta',
    summary: 'Methods, protocol, and how the lab keeps score.',
    accent: 'from-emerald-400/30 via-sky-400/25 to-amber-300/25',
    icon: 'settings-2',
  },
]

const SATELLITE_AREAS = [
  {
    key: 'archives',
    totalKey: 'archives',
    label: 'Archives',
    summary: 'Provenance, collectables, and longitudinal indices.',
    accent: 'from-amber-500/35 via-rose-500/25 to-purple-500/30',
    icon: 'archive',
  },
  {
    key: 'docs',
    totalKey: 'docs',
    label: 'Docs',
    summary: 'Working documentation, theming notes, and logs.',
    accent: 'from-cyan-400/35 via-blue-400/25 to-emerald-400/30',
    icon: 'file-text',
  },
  {
    key: 'flower_reports_showcase',
    totalKey: 'flowers',
    label: 'Flower Reports',
    summary: 'Retail audits, normalized menus, and data slices.',
    accent: 'from-lime-400/35 via-emerald-400/30 to-sky-400/25',
    icon: 'sprout',
    hrefFallback: '/flower-reports/',
  },
]

const asTime = value => {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  const date = new Date(value)
  return Number.isFinite(date?.getTime?.()) ? date.getTime() : 0
}

const itemTime = item => asTime(item?.date || item?.data?.date)

const sortByFresh = (items = []) =>
  items
    .filter(Boolean)
    .slice()
    .sort((a, b) => itemTime(b) - itemTime(a))

const filterByFolder = (all = [], folder) =>
  all.filter(
    item => typeof item?.inputPath === 'string' && item.inputPath.includes(`/content/${folder}/`),
  )

const gatherArea = (all, folder) => {
  const matches = filterByFolder(all, folder)
  const indexEntry = matches.find(isIndexEntry)
  const entries = matches.filter(item => item?.url && !isIndexEntry(item))
  return { indexEntry, entries }
}

const buildGarden = data => {
  const all = data.collections?.all || []
  const work = data.collections?.work || []
  const totals = { total: work.length }

  const core = CORE_AREAS.map(def => {
    const area = gatherArea(all, def.key)
    const collection = sortByFresh(data.collections?.[def.key] || area.entries)
    const fallbackHref = def.hrefFallback || collection[0]?.url
      || `/${def.key.replace(/_/gu, '-')}/`
    const href = area.indexEntry?.url || fallbackHref
    const entries = collection.filter(item => item?.url && item.url !== href)
    const count = entries.length
    totals[def.totalKey] = count
    return {
      ...def,
      href,
      count,
      entries: entries.slice(0, 4),
    }
  })

  const satellites = SATELLITE_AREAS.map(def => {
    const area = gatherArea(all, def.key)
    const collection = sortByFresh(area.entries)
    const fallbackHref = def.hrefFallback || collection[0]?.url
      || `/${def.key.replace(/_/gu, '-')}/`
    const href = area.indexEntry?.url || fallbackHref
    const count = collection.length
    totals[def.totalKey] = count
    return {
      ...def,
      href,
      count,
      entries: collection.slice(0, 3),
    }
  })

  const latest = sortByFresh(work.length ? work : all).slice(0, 9)

  return { totals, core, satellites, latest }
}

export default {
  title: 'Ideas, prototypes, and tools—shipped straight from the lab.',
  lede:
    'Effusion Labs explores concepts until they become working systems. Browse projects in progress, sparks of inspiration, and the models that tie them together.',

  eleventyComputed: {
    ctas: data => {
      const projects = (data.collections.projects || []).slice().sort((a, b) =>
        itemTime(b) - itemTime(a)
      )
      const latestProject = projects.find(entry => entry?.url)
      return [
        {
          href: latestProject ? latestProject.url : '/work/',
          label: latestProject ? 'Open the latest build' : 'Explore the lab',
        },
        {
          href: '/work/',
          label: 'Browse all work',
          variant: 'ghost',
        },
      ]
    },
    inventory: data => buildGarden(data).totals,
    coreLanes: data => buildGarden(data).core,
    satelliteLanes: data => buildGarden(data).satellites,
    latest: data => buildGarden(data).latest,
  },
}
=======
const {
  dailySeed,
  getToday,
  getTryNow,
  buildIdeaPathways,
  getQuestions,
  exploreLinks,
} = require('../lib/homepage');
const questions = require('./_data/questions.json');

module.exports = (data = {}) => {
  const seed = dailySeed();
  const collections = data.collections || {};
  const caps = data.homepageCaps || { today: 3, pathways: 3, questions: 3, notebook: 4 };
  const recentAll = collections.recentAll || [];

  const featured = (collections.featured || [])[0] || null;
  const today = getToday(recentAll, { seed, limit: caps.today });
  const tryNow = getTryNow(collections.interactive || [], { limit: caps.tryNow ? caps.tryNow[1] : 3 });
  const ideaPathways = buildIdeaPathways(collections, { seed, limit: caps.pathways });
  const openQuestions = getQuestions(questions, { seed, limit: caps.questions });
  const notebook = recentAll.take ? recentAll.take(caps.notebook) : recentAll.slice(0, caps.notebook);
  const explore = exploreLinks(collections);

  return { featured, today, tryNow, ideaPathways, openQuestions, notebook, explore };
};
>>>>>>> broken/codex/add-dark-mode-as-default-with-light-mode-option
