import { fileURLToPath, URL } from 'node:url';
// vite.config.mjs
import tailwind from '@tailwindcss/vite';

export default {
  server: { fs: { allow: [fileURLToPath(new URL('./', import.meta.url)), fileURLToPath(new URL('./src', import.meta.url))] } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [tailwind()],
    css: { devSourcemap: true }
};
