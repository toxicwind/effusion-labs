// Vite base config for Eleventy MPA
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const srcRoot = fileURLToPath(new URL('../../src', import.meta.url))

export default defineConfig({
  appType: 'mpa',
  resolve: {
    alias: {
      '@': srcRoot,
      '/src': srcRoot,
    },
  },
  plugins: [tailwindcss()],
  css: { devSourcemap: true },
})
