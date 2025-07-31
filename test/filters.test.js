const { readableDate, htmlDateString, limit, jsonify } = require('../lib/filters');
const assert = require('node:assert');
const { test } = require('node:test');

test('readableDate formats correctly', () => {
  const date = new Date('2023-01-15T00:00:00Z');
  assert.strictEqual(readableDate(date), 'January 15th, 2023');
});

test('htmlDateString formats correctly', () => {
  const date = new Date('2023-01-15T00:00:00Z');
  assert.strictEqual(htmlDateString(date), '2023-01-15');
});

test('limit returns subset', () => {
  assert.deepStrictEqual(limit([1,2,3,4],2), [1,2]);
});

test('jsonify serializes pages', () => {
  const fake = [{
    url: '/x',
    fileSlug: 'x',
    inputPath: __filename,
    data: { title: 'X', aliases: [] }
  }];
  const json = JSON.parse(jsonify(fake));
  assert.strictEqual(json[0].url, '/x');
  assert.ok(json[0].inputContent.includes('jsonify'));
});
