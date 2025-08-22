// tailwind.config.mjs
// Brutalist / KAWS-adjacent type: heavy geometric headings + rounded sans body.
export default {
  theme: {
    extend: {
      fontFamily: {
        heading: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Rubik", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      letterSpacing: {
        brutal: "-0.025em",
        tightish: "-0.01em",
        mega: "0.08em",
      },

      colors: {
        primary: "hsl(var(--p) / <alpha-value>)",
        info: "hsl(var(--in) / <alpha-value>)",
        success: "hsl(var(--su) / <alpha-value>)",
        warning: "hsl(var(--wa) / <alpha-value>)",
        error: "hsl(var(--er) / <alpha-value>)",
        background: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        codebg: "rgb(var(--color-code-bg) / <alpha-value>)",
        codetext: "rgb(var(--color-code-text) / <alpha-value>)",
        electric: "rgb(0 191 255 / <alpha-value>)",
      },

      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            color: "hsl(var(--bc))",
            h1: {
              fontFamily: theme("fontFamily.heading"),
              fontWeight: "800",
              letterSpacing: theme("letterSpacing.brutal"),
              textTransform: "uppercase",
              color: "hsl(var(--bc))",
            },
            h2: {
              fontFamily: theme("fontFamily.heading"),
              fontWeight: "800",
              letterSpacing: theme("letterSpacing.brutal"),
              textTransform: "uppercase",
              color: "hsl(var(--bc))",
            },
            h3: {
              fontFamily: theme("fontFamily.heading"),
              fontWeight: "700",
              letterSpacing: theme("letterSpacing.tightish"),
              color: "hsl(var(--bc))",
            },
            p: {
              fontFamily: theme("fontFamily.body"),
              letterSpacing: theme("letterSpacing.tightish"),
            },
            a: {
              color: "hsl(var(--p))",
              textDecoration: "none",
              fontWeight: "600",
              "&:hover": { color: "hsl(var(--pf))", textDecoration: "underline" },
            },
            strong: { color: "hsl(var(--bc))" },
            blockquote: {
              borderLeftColor: "hsl(var(--bc)/.22)",
              color: "hsl(var(--bc)/.85)",
            },
            code: {
              fontFamily: theme("fontFamily.mono"),
              backgroundColor: "hsl(var(--b2))",
              color: "hsl(var(--bc))",
              padding: "0.15em 0.35em",
              borderRadius: "0.25rem",
            },
            "code::before": { content: "none" },
            "code::after": { content: "none" },
            hr: { borderColor: "hsl(var(--bc)/.22)" },
            "ul > li::marker": { color: "hsl(var(--p))" },
            "ol > li::marker": { color: "hsl(var(--p))" },
            table: { borderColor: "hsl(var(--bc)/.14)" },
            thead: { borderBottomColor: "hsl(var(--bc)/.22)" },
          },
        },
        invert: {
          css: {
            color: "hsl(var(--bc))",
            a: { color: "hsl(var(--p))", "&:hover": { color: "hsl(var(--pf))" } },
            blockquote: { borderLeftColor: "hsl(var(--bc)/.32)" },
            hr: { borderColor: "hsl(var(--bc)/.32)" },
          },
        },
      }),
    },
  },
  plugins: [],
};
