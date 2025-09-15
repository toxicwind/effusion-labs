# Theming

Effusion Labs ships with a default dark theme and an optional light mode. Theme colors and typography are driven by CSS custom properties declared in `src/styles/tokens.css` and exposed to Tailwind as design tokens.

## Tokens

```css
:root {
  --step-0: clamp(1rem, calc(0.94rem + 0.17vw), 1.2rem);
  --step-1: clamp(1.13rem, calc(1.06rem + 0.27vw), 1.44rem);
  /* ... */
}
html[data-theme='dark'] {
  --color-bg: 18 18 18;
  --color-surface: 35 35 35;
  --color-text: 235 235 235;
}
html[data-theme='light'] {
  --color-bg: 245 245 245;
  --color-surface: 230 230 230;
  --color-text: 30 30 30;
}
```

Headings use the Merriweather typeface while body copy defaults to Inter for improved readability.

Utilities like `bg-background`, `bg-surface` and `text-text` resolve to these variables so the same classes work across themes.

## Toggle

The header exposes a keyboard-accessible button that switches between dark and light modes. The choice is saved to `localStorage` and applies on first paint without flashing.

## Extending

Add new variables in `tokens.css` and reference them from `tailwind.config.mjs` to create additional color roles or extend the type scale.
