# Theming

Effusion Labs now ships with DaisyUI's `dim` palette as the primary experience
and promotes `silk` as the high-key fallback. Both modes are defined in
`src/assets/css/app.css`, where CSS variables feed Tailwind's color tokens.

## Tokens

```css
:root,
html[data-theme='dim'] {
  color-scheme: dark;
  --color-bg: 42 48 60;
  --color-surface: 36 41 51;
  --color-text: 178 204 214;
  --color-primary: 159 232 141;
}

html[data-theme='silk'] {
  color-scheme: light;
  --color-bg: 247 245 243;
  --color-surface: 243 237 233;
  --color-text: 75 71 67;
  --color-primary: 28 28 41;
}
```

Tailwind utilities such as `bg-background`, `bg-surface` and `text-text`
resolve to these values, so the same markup adapts across modes without
duplicates.

## Toggle

The site boots with `dim` regardless of system settings. The header button
invokes `ThemeUtils.toggleTheme()` to swap between `dim` and `silk`, persists
the selection to `localStorage`, and refreshes `meta[color-scheme]` so browsers
draw widgets with the right contrast.

## Extending

Add new variables in `app.css`, update `tailwind.config.mjs` if you need
additional semantic colors, and call `ThemeUtils.configure()` with a custom
`allowed` array when introducing extra DaisyUI themes.
