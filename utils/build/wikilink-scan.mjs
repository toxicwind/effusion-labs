// Tiny, defensive wikilink scanner for stability tests
export function scanWikilinks(input) {
  const src =
    typeof input === 'string'
      ? input
      : String(input?.documentElement?.innerHTML ?? input ?? '')
  const out = []
  const re = /\[\[([^\]]+)\]\]/g
  let m
  while ((m = re.exec(src))) {
    const raw = m[1]
    const [name, title] = raw.split('|')
    const result = {
      raw,
      name: name?.trim() ?? '',
      title: title?.trim() ?? '',
    }
    out.push(result)
  }
  return out
}
