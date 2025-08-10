const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const nunjucks = require('nunjucks');
const {
  getToday,
  getTryNow,
  buildIdeaPathways,
  getQuestions,
} = require('../lib/homepage');

const templateSrc = fs.readFileSync(path.join('src','index.njk'), 'utf8');
const body = templateSrc.replace(/^---[\s\S]*?---\n/, '');
const env = nunjucks.configure(['src/_includes', 'src/_includes/components'], { autoescape: false, noCache: true });
env.addFilter('htmlDateString', (d) => new Date(d).toISOString());
env.addFilter('readableDate', (d) => new Date(d).toISOString().slice(0, 10));

function item(type, title, date, extra = {}) {
  return {
    url: `/${type}/${title.toLowerCase().replace(/\s+/g,'-')}/`,
    date: new Date(date),
    data: { title, type, tags: ['a'], ...extra },
  };
}

function render(ctx) {
  return env.renderString(body, ctx).trim();
}

test('homepage populated snapshot', () => {
  const seed = 'TEST';
  const collections = {
    recentAll: [
      item('project','Alpha','2025-08-01'),
      item('concept','Beta','2025-08-02'),
      item('spark','Gamma','2025-08-03'),
      item('meta','Delta','2025-08-04'),
    ],
    interactive: [item('project','Interactive','2025-08-05',{interactive:true})],
    featured: [item('project','Featured','2025-08-06',{featured:true})],
    projects: [item('project','Alpha','2025-08-01')],
    concepts: [item('concept','Beta','2025-08-02')],
    sparks: [item('spark','Gamma','2025-08-03')],
    meta: [item('meta','Delta','2025-08-04')],
  };
  const today = getToday(collections.recentAll, { seed, limit:3 });
  const tryNow = getTryNow(collections.interactive, { limit:3 });
  const pathways = buildIdeaPathways(collections, { seed, limit:3 });
  const questions = getQuestions(['Q1','Q2','Q3','Q4'], { seed, limit:3 });
  const notebook = collections.recentAll.slice(0,4);
  const explore = [
    { title:'Projects', url:'/projects/', count: collections.projects.length },
    { title:'Concepts', url:'/concepts/', count: collections.concepts.length },
    { title:'Sparks', url:'/sparks/', count: collections.sparks.length },
    { title:'Meta', url:'/meta/', count: collections.meta.length },
  ];
  const html = render({ featured: collections.featured[0], today, tryNow, ideaPathways: pathways, openQuestions: questions, notebook, explore });
  const snapPath = path.join(__dirname,'__snapshots__','homepage-populated.html');
  if (!fs.existsSync(snapPath)) fs.writeFileSync(snapPath, html);
  const expected = fs.readFileSync(snapPath,'utf8');
  assert.strictEqual(html, expected);
});

test('homepage empty snapshot', () => {
  const html = render({ featured:null, today:[], tryNow:[], ideaPathways:[], openQuestions:[], notebook:[], explore:[] });
  const snapPath = path.join(__dirname,'__snapshots__','homepage-empty.html');
  if (!fs.existsSync(snapPath)) fs.writeFileSync(snapPath, html);
  const expected = fs.readFileSync(snapPath,'utf8');
  assert.strictEqual(html, expected);
});
