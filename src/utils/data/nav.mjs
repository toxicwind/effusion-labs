// src/utils/data/nav.mjs
import { CONTENT_AREAS } from '../site.mjs'

export function buildNav() {
  const areaLinks = CONTENT_AREAS.map(a => ({
    title: a.charAt(0).toUpperCase() + a.slice(1),
    url: `/${a}/`,
  }))
  const nav = [
    { title: 'Showcase', url: '/' },
    ...areaLinks,
    { title: 'Map', url: '/map/' },
    {
      title: 'GitHub',
      url: 'https://github.com/toxicwind/effusion-labs',
      external: true,
    },
  ].map((item, idx) => ({ ...item, order: idx + 1 }))
  return nav
}

export default { buildNav }
