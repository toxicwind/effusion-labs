import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResolvers } from '../../lib/interlinkers/resolvers.mjs';
import { getUnresolvedItems } from '../../lib/interlinkers/unresolved-report.mjs';

await test('omitted-kind: unresolved link soft-renders and logs attemptedKinds', () => {
  const resolvers = createResolvers();
  const html = resolvers.get('omitted')({ name: 'nonexistent-slug' }, { data: {} });
  assert.match(html, /interlink--soft/);
  const items = getUnresolvedItems();
  assert.ok(items.length >= 1, 'no unresolved items recorded');
  const last = items[items.length - 1];
  assert.ok(Array.isArray(last.attemptedKinds), 'attemptedKinds missing');
});

