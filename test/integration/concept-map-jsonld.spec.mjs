import test from 'node:test';
import assert from 'node:assert';
import generateConceptMapJSONLD from '../../helpers/data/concept-map';

test('concept map JSON-LD export generates @context and @graph', () => {
  const pages = [
    {
      url: '/sparks/s1/',
      data: { title: 'Spark One', tags: ['sparks'], content: 'Links to [[Concept A]].' }
    },
    {
      url: '/concepts/concept-a/',
      data: { title: 'Concept A', tags: ['concepts'], content: 'Related to [[Project X]].' }
    },
    {
      url: '/projects/project-x/',
      data: { title: 'Project X', tags: ['projects'], content: '' }
    }
  ];

  const jsonld = generateConceptMapJSONLD(pages);
  assert.ok(jsonld['@context']);
  assert.ok(Array.isArray(jsonld['@graph']));
  const nodeIds = jsonld['@graph'].filter(n => n['@type'] === 'Node').map(n => n['@id']);
  assert.deepEqual(new Set(nodeIds), new Set(pages.map(p => p.url)));
});
