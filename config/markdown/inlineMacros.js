/**
 * Helper to define simple inline macros.
 * @param {string} name - macro name
 * @param {string} after - rule to insert after
 * @param {(value:string)=>string} toHtml - HTML generator
 */
const toStringSafe = (v) => (v == null ? '' : (typeof v === 'string' ? v : String(v)));

export const inlineMacro = (name, after, toHtml) => (md) => {
  const regex = new RegExp(`^@${name}\\(([^)]+)\\)`);
  md.inline.ruler.after(after, name, (state, silent) => {
    if (!state || typeof state.src !== 'string' || typeof state.pos !== 'number') return false;
    const src = state.src;
    const start = Math.max(0, state.pos | 0);
    const slice = src.slice(start);
    const m = slice.match(regex);
    if (!m) return false;
    if (!silent) state.push({ type: 'html_inline', content: toHtml(toStringSafe(m[1])) });
    state.pos += m[0].length;
    return true;
  });
};

/** Inline audio embedding macro */
export const audioEmbed = inlineMacro('audio', 'emphasis', src => `<audio controls class="audio-embed" src="${src}"></audio>`);

/** Inline QR-code embedding macro */
export const qrEmbed = inlineMacro('qr', 'audio', s => {
  const src = encodeURIComponent(s);
  return `<img class="qr-code" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${src}" alt="QR code">`;
});

export default { inlineMacro, audioEmbed, qrEmbed };
