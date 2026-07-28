# Proovd — Landing Page

Single-page marketing site (English only) built for **SEO** and **Core Web
Vitals**.

## Stack

- **Next.js 16** (App Router) + **TypeScript** — Turbopack bundler
- **npm**
- **Biome** — linting + formatting (no ESLint, no Prettier)
- **Vitest** + React Testing Library (unit) · **Playwright** (E2E/smoke)
- **No animation library.** Motion runs on the Web Animations API + rAF via
  `lib/motion.ts`. GSAP was removed; don't reintroduce it.
- **three** — dynamically imported, only for the Evan section's corner-peel
- **Satoshi**, self-hosted (variable woff2) via `@font-face` in `proovd.css`
- **Docker** (`output: "standalone"`) → **Dokploy** on a VPS (auto-deploy on `main`)
- **Analytics:** Microsoft Clarity + self-hosted Umami — env-gated, production-only

Styling architecture: `styles/proovd.css` global design system + **CSS Modules**
for future page-level styles. No Tailwind, no CSS-in-JS, no UI libraries.

## Scripts

| Script                | Does                                             |
| --------------------- | ------------------------------------------------ |
| `npm run dev`         | Start the dev server (http://localhost:3000)     |
| `npm run build`       | Production build (standalone output)             |
| `npm run start`       | Serve the production build                       |
| `npm run lint`        | Biome check (lint + format diagnostics)          |
| `npm run format`      | Biome format, writing changes                    |
| `npm test`            | Vitest unit tests                                |
| `npm run test:e2e`    | Playwright smoke test (builds + serves first)    |

## Design system & fonts (where files go)

- `styles/proovd.css` — **source of truth**; imported once in `app/layout.tsx`.
  Never edited by tooling (excluded from Biome). Source copy lives in
  `docs/design-system/`.
- `styles/fonts/Satoshi-Variable.woff2`, `styles/fonts/Satoshi-VariableItalic.woff2`
  — referenced by `proovd.css`'s `@font-face` (relative `fonts/…` URLs).
- `docs/design-system/` — the DNA spec plus the master copy of `proovd.css`.

## Environment variables

All optional, and all **inlined at build time** (see DEPLOY.md) — set them in
`.env.local` for local runs. There is no `.env.example`.

| Variable                         | Purpose                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`           | Canonical origin (metadataBase, canonical, robots, sitemap). Falls back to `https://proovd.co`. |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Microsoft Clarity project id (prod-only, optional).          |
| `NEXT_PUBLIC_UMAMI_SRC`          | Umami tracker script URL (prod-only, optional).              |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID`   | Umami website id (UUID); required with `NEXT_PUBLIC_UMAMI_SRC`. |
| `GOOGLE_SITE_VERIFICATION`       | Search Console token. The one non-`NEXT_PUBLIC_` var — read server-side in the metadata. |

Analytics render **only** when `NODE_ENV=production` **and** the relevant vars
are set — development stays free of third-party scripts.

## Assets to replace before launch

- `app/favicon.ico` (create-next-app default) and app icons.
- `public/og.png` — default Open Graph / Twitter share image (1200×630).
- `siteConfig.defaultTitle` in `lib/site-config.ts` is still just "Proovd".

## Deployment

See [DEPLOY.md](DEPLOY.md) — Docker image built by Dokploy, auto-deployed on push
to `main`.
