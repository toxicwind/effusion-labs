# MSCHF Overlay

The MSCHF overlay decorates pages with seeded decals and grid textures while keeping content accessible.

## Controls

Attach attributes to the `#page-shell` wrapper:

| Attribute              | Values                                           | Default | Description                                                      |
| ---------------------- | ------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `data-mschf`           | `on` \| `off` \| `auto`                          | `auto`  | Enable overlay or force disable.                                 |
| `data-mschf-intensity` | `lite` \| `bold` \| `loud` \| `calm`             | random  | Governs element counts and probabilities.                        |
| `data-mschf-seed-mode` | `page` \| `session`                              | `page`  | Ephemeral seed per load or stable for a tab session.             |
| `data-mschf-style`     | `collage` \| `structural` \| `playful` \| `auto` | `auto`  | Aesthetic strategy mix; `auto` picks a style randomly each load. |

Use `localStorage.setItem('mschf:off','1')` to opt out persistently.

## Aesthetic Strategies

`data-mschf-style="auto"` (default) randomly selects an aesthetic strategy per page seed. If `data-mschf-intensity` is omitted, the overlay picks a random intensity so each visit feels fresh.
`collage` fuses four groups: base scaffold, culture-coded ephemera, lab/blueprint motifs, and framing stickers. Other styles limit the mix:

- **structural** – base + lab motifs only.
- **playful** – base + culture-coded ephemera.

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
