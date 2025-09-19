const SCRIPT_RE = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi
const TOKENS = [/\{\{[\s\S]*?\}\}/g, /\{%\s*[\s\S]*?%\}/g, /\{#\s*[\s\S]*?#\}/g]

function encode(body) {
  let out = body, map = []
  TOKENS.forEach(re => {
    out = out.replace(re, m => {
      const id = '___NJK_TOKEN_' + map.length + '___'
      map.push(m)
      return id
    })
  })
  return { out, map }
}
function decode(body, map) {
  return map.reduce((s, m, i) => s.replace(new RegExp('___NJK_TOKEN_'+i+'___','g'), m), body)
}

module.exports = {
  parsers: {
    'jinja-template': {
      parse: (text, parsers, options) => {
        const real = (options.__jinjaRealParser || parsers['jinja-template'])
        return real.parse(text, parsers, options)
      },
      astFormat: 'html',
      preprocess(text, options) {
        const real = (options.__jinjaRealPreprocess ||
          (options.plugins||[]).map(p=>p.parsers&&p.parsers['jinja-template'])
            .filter(Boolean)[0]?.preprocess)
        const src = typeof real === 'function' ? real(text, options) : text
        return src.replace(SCRIPT_RE, (all, open, body, close) => {
          const { out, map } = encode(body)
          const stash = (options.__njkStashMaps ||= [])
          const key = stash.push(map) - 1
          return `${open}/*__NJK_STASH_${key}__*/\n${out}\n${close}`
        })
      },
      postprocess(text, options) {
        const real = (options.__jinjaRealPostprocess ||
          (options.plugins||[]).map(p=>p.parsers&&p.parsers['jinja-template'])
            .filter(Boolean)[0]?.postprocess)
        const formatted = typeof real === 'function' ? real(text, options) : text
        return formatted.replace(SCRIPT_RE, (all, open, body, close) => {
          const m = body.match(/\/\*__NJK_STASH_(\d+)__\*\//)
          if (!m) return all
          const idx = Number(m[1])
          const map = (options.__njkStashMaps || [])[idx] || []
          const clean = body.replace(/\/\*__NJK_STASH_\d+__\*\//, '')
          return `${open}${decode(clean, map)}${close}`
        })
      },
    },
  },
}
