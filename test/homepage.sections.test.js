const test = require('node:test');
const assert = require('node:assert');
const indexData = require('../src/index.11tydata.js');

function item(type, title, date, extra = {}) {
  return {
    url: `/${type}/${title.toLowerCase().replace(/\s+/g,'-')}/`,
    date: new Date(date),
    data: { title, type, tags: ['a'], ...extra },
  };
}

test('homepage data limits sections to at least three items', () => {
  const collections = {
    recentAll: [
      item('project','Alpha','2025-08-01'),
      item('concept','Beta','2025-08-02'),
      item('spark','Gamma','2025-08-03'),
      item('meta','Delta','2025-08-04'),
      item('project','Epsilon','2025-08-05'),
    ],
    interactive: [
      item('project','Interactive1','2025-08-06',{interactive:true}),
      item('project','Interactive2','2025-08-07',{interactive:true}),
      item('project','Interactive3','2025-08-08',{interactive:true})
    ],
    featured: [
      item('project','Featured1','2025-08-09',{featured:true}),
      item('project','Featured2','2025-08-10',{featured:true}),
      item('project','Featured3','2025-08-11',{featured:true})
    ],
    projects: [
      item('project','Alpha','2025-08-01'),
      item('project','BetaProject','2025-08-02'),
      item('project','GammaProject','2025-08-03')
    ],
    concepts: [
      item('concept','Beta','2025-08-02'),
      item('concept','Concept2','2025-08-03'),
      item('concept','Concept3','2025-08-04')
    ],
    sparks: [
      item('spark','Gamma','2025-08-03'),
      item('spark','Spark2','2025-08-04'),
      item('spark','Spark3','2025-08-05')
    ],
    meta: [
      item('meta','Delta','2025-08-04'),
      item('meta','Meta2','2025-08-05'),
      item('meta','Meta3','2025-08-06')
    ],
  };
  const data = indexData({ collections, homepageCaps: { featured:3, today:3, tryNow:[1,3], pathways:3, questions:3, notebook:4 } });
  assert.strictEqual(data.featured.length,3);
  assert.strictEqual(data.today.length,3);
  assert.strictEqual(data.tryNow.length,3);
  assert.strictEqual(data.ideaPathways.length,3);
  assert.strictEqual(data.openQuestions.length,3);
  assert.strictEqual(data.notebook.length,4);
});
