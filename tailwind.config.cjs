/*  tailwind.config.cjs  (CommonJS so the plugin’s require() always works) */
module.exports = {
  content: ["./src/**/*.{njk,md,html,js}"],
  theme: {
    extend: {
      colors: {
        cerulean:   "#0698e0",
        danube:     "#60a0cd",
        lapis:      "#0A84FF",
        "text-light": "#f0f0f0",
        "text-dark":  "#1a1a1a",
        "bg-dark":    "#0f0f0f"
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
        lab: {
          primary: "#0698e0",
          secondary: "#60a0cd",
          accent: "#0A84FF",
          neutral: "#1a1a1a",
          "base-100": "#0f0f0f"
        }
      },
      "dark"
    ]
  }
};
