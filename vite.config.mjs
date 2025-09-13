// vite.config.mjs
import { fileURLToPath, URL } from 'node:url';
import tailwind from '@tailwindcss/vite';

// --- Define project paths for clarity and reuse ---
const projectRoot = fileURLToPath(new URL('./', import.meta.url));
const srcRoot = fileURLToPath(new URL('./src', import.meta.url));

export default {
  // Dev server settings
  server: {
    // This is critical for the Eleventy plugin. It allows Vite's dev
    // server (running in `_site`) to access files in the project root and `src`.
    fs: {
      allow: [projectRoot, srcRoot],
    },
  },

  // Path alias configuration
  resolve: {
    alias: {
      // This allows you to use `import '@/...'` to reference files in the `src` directory.
      '@': srcRoot,
    },
  },

  // Vite plugins
  plugins: [
    tailwind(),
  ],

  // CSS-specific options
  css: {
    // Enable CSS source maps during development for easier debugging in the browser.
    devSourcemap: true,
  },
};