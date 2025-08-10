#!/usr/bin/env node
const { webpageToMarkdown } = require('./lib/webpageToMarkdown');
const crypto = require('node:crypto');

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node webpage-to-markdown.js <URL>');
    process.exit(1);
  }
  try {
    const md = await webpageToMarkdown(url);
    const hash = crypto.createHash('sha256').update(md).digest('hex');
    console.log(md);
    console.log(`sha256:${hash}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
