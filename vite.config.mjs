// vite.config.mjs
// Vite 7 (Node 20.19+), Tailwind CSS v4 + daisyUI
// - Tailwind: use the first-party Vite plugin (no PostCSS config needed)
// - daisyUI: enable via @plugin in your CSS (no tailwind.config.* required)

import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'


const srcRoot = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  // Eleventy is an MPA; match the Eleventy Vite plugin’s default
  // so running Vite directly won’t assume SPA.
  appType: 'mpa',
  resolve: {
    alias: {
      '@': srcRoot, // import Foo from '@/components/Foo.js'
    },
  },

  plugins: [
    tailwindcss(), // Tailwind v4 via Vite plugin
  ],

  css: {
    // Handy in dev; leave build sourcemaps at defaults unless you know you need them
    devSourcemap: true,
  },

  // Vite 7’s defaults already target “baseline widely available” browsers;
  // no need to set build.target unless you have special requirements.
})
