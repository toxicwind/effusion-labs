const assert = require('node:assert');
const { test } = require('node:test');
const http = require('node:http');
const { webpageToMarkdown } = require('../lib/webpageToMarkdown');

test('webpageToMarkdown converts served HTML to markdown', async () => {
  const html = '<!doctype html><html><body><h1>Hello</h1><p>World</p></body></html>';
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();
  const md = await webpageToMarkdown(`http://localhost:${port}/`);
  server.close();
  assert.match(md, /Hello/);
  assert.match(md, /World/);
});
