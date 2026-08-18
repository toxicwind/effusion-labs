// src/utils/archives/naming-canon.mjs
export function slugCanonicalProduct(prod = {}) {
  const rawId = String(prod.product_id || '')
  const slug = s =>
    String(s)
      .toLowerCase()
      .trim()
      .replace(/[^\da-z]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  const tokens = rawId.split('--').filter(Boolean)
  if (tokens.length < 4) return slug(rawId)
  const [brand, line, character, ...rest] = tokens
  const volatile = [
    /^\d{8}$/i,
    /^(reg-[a-z]{2}|us|uk|cn|jp|th|sg|kr|tw)$/i,
    /^(std|xl|xs|s|m|l)$/i,
  ]
  const core = rest.filter(t => !volatile.some(re => re.test(t)))
  const parts = [brand, line, character, ...core].filter(Boolean)
  return parts.join('-').replace(/-+/g, '-').toLowerCase()
}

export default { slugCanonicalProduct }
