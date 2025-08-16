const { fetch } = require('undici');

async function fetchMarkdown(targetUrl) {
  const gateway = process.env.OUTBOUND_MARKDOWN_URL || 'http://gateway';
  const res = await fetch(`${gateway}/convert`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: targetUrl }),
  });
  return res.json();
}

module.exports = { fetchMarkdown };
