// vite.config.mjs
import { fileURLToPath, URL } from 'node:url';
import tailwind from '@tailwindcss/vite';

// Define project paths for clarity and reuse
const srcRoot = fileURLToPath(new URL('./src', import.meta.url));

export default {
  // Path alias configuration (for builds and editor support)
  resolve: {
    alias: {
      '@': srcRoot,
    },
  },

  // Vite plugins
  plugins: [
    tailwind(),
  ],

  // CSS-specific options
  css: {
    devSourcemap: true,
  },
};