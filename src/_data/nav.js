import { CONTENT_AREAS } from '../../config/site.js';

const areaLinks = CONTENT_AREAS.map((a) => ({
  title: a.charAt(0).toUpperCase() + a.slice(1),
  url: `/${a}/`,
}));

const nav = [
  { title: 'Showcase', url: '/' },
  ...areaLinks,
  { title: 'Map', url: '/map/' },
  { title: 'Join the group', url: 'https://github.com/orgs/effusion-labs/discussions', external: true },
  { title: 'GitHub', url: 'https://github.com/effusion-labs/effusion-labs', external: true },
].map((item, idx) => ({ ...item, order: idx + 1 }));

export default nav;
