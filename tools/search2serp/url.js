function buildGoogleUrl({ q, hl='en', gl='us', num=10, start=0 }){
  num = Math.min(Number(num) || 10, 20);
  start = Math.max(Number(start) || 0, 0);
  const params = new URLSearchParams({ q, hl, gl, num:String(num), start:String(start) });
  return `https://www.google.com/search?${params.toString()}`;
}

module.exports = { buildGoogleUrl };
