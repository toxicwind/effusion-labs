# Structure Plan

## Before
```
src/
  assets/
    css/tailwind.css
    js/base.js
    js/footnote-nav.js
    logo.png
  _includes/
  _data/
  content/
```

## Proposed After
```
src/
  styles/
    app.tailwind.css
  scripts/
    base.js
    footnote-nav.js
  assets/
    static/
      logo.png
  lib/
    ... (unchanged)
```
Output:
```
_site/
  assets/
    css/app.css
    js/
      base.js
      footnote-nav.js
```

## Move Map
- `src/assets/css/tailwind.css` → `src/styles/app.tailwind.css`
- `src/assets/js/base.js` → `src/scripts/base.js`
- `src/assets/js/footnote-nav.js` → `src/scripts/footnote-nav.js`
- `src/assets/logo.png` → `src/assets/static/logo.png`

Passthrough changes: ensure only compiled assets output.
Rollback: move files back to original locations and revert template hrefs.
