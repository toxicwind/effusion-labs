import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { scanWikilinks } from '../../lib/wikilink/scan.mjs';

test('D1: DOM input tolerance — scanning does not throw and finds one link', () => {
  const dom = new JSDOM('<!doctype html><p>[[series:Hello World]]</p>');
  const doc = dom.window.document;
  const out = scanWikilinks(doc);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'series:Hello World');
});

test('D2: String parity — same content as a string yields equivalent discovery', () => {
  const html = '<!doctype html><p>[[series:Hello World]]</p>';
  const a = scanWikilinks(html);
  const b = scanWikilinks(new JSDOM(html).window.document);
  assert.equal(a.length, b.length);
  assert.deepEqual(a[0], b[0]);
});

