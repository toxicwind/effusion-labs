# typography-colors Ledger

## Criteria & Proof

1. Light and dark backgrounds set to accessible values.
   - Evidence: `src/styles/tokens.css`
   - Test: `docs/knowledge/typography-colors-green.log`
2. Text contrast meets WCAG AA.
   - Test: `docs/knowledge/typography-colors-green.log`
3. Tailwind exposes Merriweather and Inter fonts.
   - Evidence: `tailwind.config.mjs`
   - Test: `docs/knowledge/typography-colors-green.log`
4. Theming guide updated.
   - Evidence: `docs/theming.md`
   - Check: `docs/knowledge/typography-colors-docs.log`

## Index

4/4 criteria satisfied

## Rollback

`git reset --hard 8a93dd4989c4a234db8e8025e92ae18fd3ae0e95`
