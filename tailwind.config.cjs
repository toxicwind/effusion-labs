/*  tailwind.config.cjs  (CommonJS so the plugin’s require() always works) */
module.exports = {
  content: ["./src/**/*.{njk,md,html,js}"],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        codebg: "rgb(var(--color-code-bg) / <alpha-value>)",
        codetext: "rgb(var(--color-code-text) / <alpha-value>)",
        primary: "#0A84FF",
        footnote: "hsl(var(--p) / <alpha-value>)"
      },
      fontFamily: {
        heading: ["'Bebas Neue'", "sans-serif"],
        body:    ["'Roboto'",     "sans-serif"]
      }
    }
  },
  // Plugins are loaded via @plugin directives in CSS
  daisyui: {
    themes: [
      {
        dark: {
          primary: "#0A84FF",
          neutral: "#1a1a1a",
          "base-100": "#000000",
          "base-200": "#1a1a1a",
          "base-300": "#2a2a2a"
        }
      },
      {
        light: {
          primary: "#0A84FF",
          neutral: "#1a1a1a",
          "base-100": "#ffffff",
          "base-200": "#f0f0f0",
          "base-300": "#d9d9d9"
        }
      }
    ]
  }
};
