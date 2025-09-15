export function luminance(rgb) {
  const [r, g, b] = rgb.split(/\s+/).map(n => parseInt(n, 10) / 255)
  const transform = c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  const [R, G, B] = [r, g, b].map(transform)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

export function contrast(bg, text) {
  const [light, dark] = [luminance(bg), luminance(text)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}
