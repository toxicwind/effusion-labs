# MSCHF Overlay

The MSCHF overlay decorates pages with seeded decals and grid textures while keeping content accessible.

## Controls

Attach attributes to the `#page-shell` wrapper:

| Attribute | Values | Default | Description |
| --- | --- | --- | --- |
| `data-mschf` | `on` \| `off` \| `auto` | `auto` | Enable overlay or force disable. |
| `data-mschf-intensity` | `lite` \| `loud` | `lite` | Governs element counts and probabilities. |
| `data-mschf-seed-mode` | `page` \| `session` | `page` | Ephemeral seed per load or stable for a tab session. |

Use `localStorage.setItem('mschf:off','1')` to opt out persistently.

## Modules

- **Faint Grid** – low-opacity radial grid, 35% chance when `loud`.
- **Crosshair** – centered ring and axes; 50% chance (`lite`) or 60% (`loud`).

## Seeds

`?mschf-seed=<n>` freezes the composition. Without a forced seed, `page` mode generates a new value for each load; `session` mode stores the seed in `sessionStorage`.

## Contracts

- Overlay elements are `aria-hidden="true"` and `pointer-events:none`.
- Respects `prefers-reduced-motion`; no animation yet.
- Overlay markup sits below interactive UI.

## Adding Zones

Decorate sections by marking them with `data-mschf-zone`. Future modules can read these markers to inject decals near the zone.
