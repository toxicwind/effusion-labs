
const { readableDate, htmlDateString, limit, jsonify, readingTime, slugify, webpageToMarkdown, truncate, shout } = require('../lib/filters');

const assert = require('node:assert');
const { test } = require('node:test');
const http = require('node:http');

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

test('readingTime estimates minutes', () => {
  const text = 'word '.repeat(450);
  assert.strictEqual(readingTime(text), '3 min read');
});

test('slugify generates URL-friendly strings', () => {
  assert.strictEqual(slugify('Hello World!'), 'hello-world');
  assert.strictEqual(slugify(' Multi   Space '), 'multi-space');
});

test('truncate shortens strings with ellipsis', () => {
  assert.strictEqual(truncate('abcdefghij', 5), 'abcde…');
  assert.strictEqual(truncate('hi', 5), 'hi');
});

test('shout uppercases text', () => {
  assert.strictEqual(shout('make noise'), 'MAKE NOISE');
});

test('shout is idempotent', () => {
  const once = shout('Echo');
  assert.strictEqual(shout(once), once);
});

test('webpageToMarkdown filter fetches and converts HTML', async () => {
  const html = '<!doctype html><html><body><h1>Hi</h1></body></html>';
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  const md = await webpageToMarkdown(`http://localhost:${port}/`);
  server.close();
  assert.match(md, /Hi/);
});
