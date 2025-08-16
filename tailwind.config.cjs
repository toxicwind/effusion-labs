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
        primary: "#2D5BFF", // Electric Blue
        footnote: "hsl(var(--p) / <alpha-value>)",
        ink: "#0B0B0B",
        paper: "#F6F6F6",
        electric: "#2D5BFF",
        lime: "#D8FF00",
        alarm: "#FF2E2E"
      },
      fontFamily: {
        heading: ["'Merriweather'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'Roboto Mono'", "monospace"]
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
