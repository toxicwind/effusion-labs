// vite.config.mjs
import tailwind from '@tailwindcss/vite';

export default {
    plugins: [tailwind()],
    css: { devSourcemap: true }
};
