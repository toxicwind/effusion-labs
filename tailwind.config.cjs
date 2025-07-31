/*  tailwind.config.cjs  (CommonJS so the plugin’s require() always works) */
module.exports = {
  content: ["./src/**/*.{njk,md,html}"],
  theme: {
    extend: {
      colors: {
        cerulean:  "#0698e0",
        danube:    "#60a0cd",
        malachite: "#10ea30",
        shamrock:  "#0dbb25",
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
  plugins: [
    require("@tailwindcss/typography"),
    require("daisyui")
  ],
  daisyui: {
    themes: [
      {
        lab: {
          primary: "#0698e0",
          secondary: "#60a0cd",
          accent: "#10ea30",
          neutral: "#1a1a1a",
          "base-100": "#0f0f0f"
        }
      },
      "dark"
    ]
  }
};
