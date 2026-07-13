# styles/

- **`proovd.css`** — the design-system source of truth (tokens, section modes,
  element identity, and the self-hosted Satoshi `@font-face`). Imported once in
  `app/layout.tsx`. **Never edit or format this file** — it is excluded from
  Biome. Update it by replacing the file from the design system.
- **`fonts/`** — self-hosted Satoshi. `Satoshi-Variable.woff2` and
  `Satoshi-VariableItalic.woff2` are referenced by the `@font-face` blocks in
  `proovd.css` via relative `fonts/…` URLs (resolved relative to the stylesheet).

Future page-level styling uses **CSS Modules** (`*.module.css`) co-located with
their components. No Tailwind, no CSS-in-JS.
