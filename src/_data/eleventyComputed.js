const toArray = v => (Array.isArray(v) ? v : v ? [v] : [])
const normalizeTitle = t => {
  if (typeof t === 'string') return t
  if (Array.isArray(t))
    return t
      .filter(v => v != null)
      .map(String)
      .join(' / ')
  if (t && typeof t === 'object') return String(t.name ?? '')
  return ''
}

export default {
  title: data => normalizeTitle(data.title),
  tags: data => {
    const merged = [
      ...toArray(data.tags),
      ...toArray(data.analytic_lens),
      ...toArray(data.memory_ref),
      ...toArray(data.spark_type),
    ].filter(v => typeof v === 'string')
    return Array.from(new Set(merged)).sort()
  },
  categories: data =>
    toArray(data.spark_type)
      .filter(v => typeof v === 'string')
      .sort(),
}
