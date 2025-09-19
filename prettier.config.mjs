// prettier.config.mjs
/** Prettier for Eleventy + NJK + Tailwind v4, complementary to flat ESLint. */
export default {
  // Core style
  semi: false,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100, // a smidge wider for templates without causing churn
  tabWidth: 2,
  arrowParens: 'avoid',
  bracketSpacing: true,
  endOfLine: 'lf',

  // Load plugins; Tailwind **last** so class sorting runs after other transforms.
  plugins: [
    './tools/dev/prettier-jinja-js-wrapper.cjs',
    'prettier-plugin-jinja-template',
    'prettier-plugin-tailwindcss',
  ],

  // Make plugin resolution robust in workspaces/CI runners.

  // Tailwind plugin: also sort classes in Nunjucks attrs like class=""
  // (v0.6+ supports arbitrary attribute names via tailwindAttributes).
  tailwindAttributes: ['class', 'className'],
  // If you keep a tailwind config file, you can hint it here:
  // tailwindConfig: './tailwind.config.*',

  overrides: [
    // Nunjucks / HTML rendered by Eleventy
    {
      files: ['**/*.njk', '**/*.html'],
      options: {
        parser: 'jinja-template',
        embeddedLanguageFormatting: 'off', // ensure scripts aren't parsed as JS
        printWidth: 100,
      },
    },
    // Markdown — wrap prose to improve diffs
    {
      files: ['**/*.md'],
      options: {
        proseWrap: 'always'
      }
    },
    // YAML (workflows, config)
    {
      files: ['**/*.y?(a)ml'],
      options: {
        printWidth: 100
      }
    },
    // JSON(5) — trailing commas are invalid in strict JSON; Prettier handles it,
    // but we keep defaults and widen width slightly to reduce noisy diffs.
    {
      files: ['**/*.json'],
      options: {
        printWidth: 100
      }
    }
  ]
};
