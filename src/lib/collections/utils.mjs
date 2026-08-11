export function isIndexEntry(item) {
  if (!item) return false
  const slug = item?.data?.page?.fileSlug
  if (slug === 'index' || slug === '_index') return true
  const stem = item?.data?.page?.filePathStem
  if (typeof stem === 'string' && /\/index$/u.test(stem)) return true
  const inputPath = item?.inputPath
  if (typeof inputPath === 'string') {
    return /\/index\.(?:md|njk|11ty\.js|html)$/iu.test(inputPath)
  }
  return false
}

export default { isIndexEntry }
