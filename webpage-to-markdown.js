#!/usr/bin/env node
const { webpageToMarkdown } = require('./lib/webpageToMarkdown');

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node webpage-to-markdown.js <URL>');
    process.exit(1);
  }
  try {
    const md = await webpageToMarkdown(url);
    console.log(md);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

main();
