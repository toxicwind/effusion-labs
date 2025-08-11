const { JSDOM } = require('jsdom');

const selectors = {
  organic: '#search .g'
};

function parseSerp(html){
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const nodes = document.querySelectorAll(selectors.organic);
  let rank = 1;
  const results = [];
  nodes.forEach(node => {
    const link = node.querySelector('a');
    const title = node.querySelector('h3');
    if(!link || !title) return;
    const snippet = node.querySelector('.VwiC3b')?.textContent.trim();
    let displayedUrl;
    try{ displayedUrl = new URL(link.href).host; }catch{}
    results.push({
      rank: rank++,
      title: title.textContent.trim(),
      url: link.href,
      displayedUrl,
      snippet,
      type: 'organic'
    });
  });
  return results;
}

module.exports = { parseSerp };
