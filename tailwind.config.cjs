/*  tailwind.config.cjs  (CommonJS so the plugin’s require() always works) */
// Tailwind v4: templates are declared via `@source` in CSS, and plugins via `@plugin`.
module.exports = {
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
  }
};
