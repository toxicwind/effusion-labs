import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'hyper-green': '#10b981',
        'hyper-dark': '#0a0a0a',
      },
    },
  },
  plugins: [],
}
export default config