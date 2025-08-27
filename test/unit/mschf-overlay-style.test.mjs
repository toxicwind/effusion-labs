// test/unit/mschf-overlay-style.test.mjs
import test from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

test('collage style includes base, ephemera, and lab modules', () => {
  const html = `<!doctype html><html><body data-mschf="on" data-mschf-intensity="test" data-mschf-style="collage"></body></html>`;
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'http://localhost',
  });
  const scriptPath = path.resolve('src/scripts/mschf-overlay.js');
  dom.window.eval(readFileSync(scriptPath, 'utf8'));
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  const doc = dom.window.document;

  assert.ok(doc.querySelector('.mschf-grid'));
  assert.ok(doc.querySelector('.mschf-crosshair'));
  assert.ok(
    doc.querySelector(
      '.mschf-tape, .mschf-stamp, .mschf-quotes, .mschf-plate, .mschf-specimen',
    ),
  );
  assert.ok(
    doc.querySelector(
      '.mschf-callout, .mschf-graph, .mschf-rings, .mschf-topo, .mschf-halftone, .mschf-crt, .mschf-perf, .mschf-starfield',
    ),
  );
});
